import * as vscode from 'vscode';
import { get_workspace_root } from '../config/caa_config';
import {
    format_all_cpp_sources,
    list_workspace_format_subfolders,
} from '../format/caa_format_service';
import { t } from '../i18n/t';
import { get_format_webview_strings } from '../i18n/webview_strings';
import { get_webview_nonce, wrap_webview_html } from './webview_utils';

export const FORMAT_VIEW_ID = 'caaComposer.format';
const STATE_KEY = 'caaComposer.formatState';

interface FormatState {
    selected_subfolders: string[];
}

/**
 * Format 侧边栏 Webview（勾选子文件夹批量 clang-format）
 */
export class FormatViewProvider implements vscode.WebviewViewProvider {
    private view_?: vscode.WebviewView;
    private state_: FormatState;

    constructor(
        private readonly extension_path_: string,
        private readonly output_channel_: vscode.OutputChannel,
        private readonly global_state_: vscode.Memento
    ) {
        this.state_ = FormatViewProvider.load_state_(global_state_);
    }

    resolveWebviewView(
        webview_view: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view_ = webview_view;
        webview_view.webview.options = { enableScripts: true };
        webview_view.webview.html = this.get_html_(webview_view.webview);

        webview_view.webview.onDidReceiveMessage(async (message) => {
            await this.handle_message_(message);
        });

        webview_view.onDidChangeVisibility(() => {
            if (webview_view.visible) {
                this.post_state_();
            }
        });
    }

    /**
     * 执行批量格式化并更新 Webview 日志
     */
    async run_format(selected_subfolders?: string[]): Promise<void> {
        await FormatViewProvider.focus();
        if (selected_subfolders !== undefined) {
            this.state_.selected_subfolders = selected_subfolders;
            this.save_state_();
            this.post_state_();
        }
        await this.execute_format_();
    }

    /**
     * 聚焦侧边栏 Format 视图
     */
    static async focus(): Promise<void> {
        await vscode.commands.executeCommand('workbench.view.extension.caa-composer-sidebar');
        await vscode.commands.executeCommand(`${FORMAT_VIEW_ID}.focus`);
    }

    private static load_state_(global_state: vscode.Memento): FormatState {
        const saved = global_state.get<FormatState>(STATE_KEY);

        return {
            selected_subfolders: saved?.selected_subfolders ?? [],
        };
    }

    private save_state_(): void {
        void this.global_state_.update(STATE_KEY, this.state_);
    }

    private get_subfolders_(): string[] {
        const workspace_root = get_workspace_root();
        if (!workspace_root) {
            return [];
        }

        return list_workspace_format_subfolders(workspace_root);
    }

    private prune_selection_(subfolders: string[]): void {
        const available = new Set(subfolders);
        this.state_.selected_subfolders = this.state_.selected_subfolders.filter((item) =>
            available.has(item)
        );
    }

    private post_state_(): void {
        const workspace_root = get_workspace_root();
        const subfolders = this.get_subfolders_();
        this.prune_selection_(subfolders);

        void this.view_?.webview.postMessage({
            type: 'state',
            payload: {
                workspace_root: workspace_root ?? '',
                subfolders,
                selected_subfolders: this.state_.selected_subfolders,
            },
        });
    }

    private async handle_message_(message: {
        type: string;
        payload?: { selected_subfolders?: string[]; folder?: string; checked?: boolean };
    }): Promise<void> {
        switch (message.type) {
            case 'ready':
            case 'refresh':
                this.post_state_();
                break;
            case 'updateSelection': {
                const selected = message.payload?.selected_subfolders ?? [];
                this.state_.selected_subfolders = selected;
                this.save_state_();
                break;
            }
            case 'selectAll': {
                this.state_.selected_subfolders = this.get_subfolders_();
                this.save_state_();
                this.post_state_();
                break;
            }
            case 'clearAll': {
                this.state_.selected_subfolders = [];
                this.save_state_();
                this.post_state_();
                break;
            }
            case 'format':
                await this.execute_format_();
                break;
        }
    }

    private async execute_format_(): Promise<void> {
        const workspace_root = get_workspace_root();
        if (!workspace_root) {
            vscode.window.showErrorMessage(t('Open a CAA workspace folder first.'));
            return;
        }

        const selected_subfolders = this.state_.selected_subfolders.filter((item) => item.length > 0);
        if (selected_subfolders.length === 0) {
            vscode.window.showWarningMessage(t('Select at least one subfolder to format.'));
            return;
        }

        void this.view_?.webview.postMessage({ type: 'clear_log' });

        const append_to_webview = (line: string): void => {
            this.output_channel_.appendLine(line);
            void this.view_?.webview.postMessage({
                type: 'log_append',
                payload: { line },
            });
        };

        const result = await format_all_cpp_sources(workspace_root, this.extension_path_, {
            target_dirs: selected_subfolders,
            on_log_line: append_to_webview,
        });

        this.output_channel_.show(true);

        void this.view_?.webview.postMessage({
            type: 'result',
            payload: {
                formatted_count: result.formatted_count,
                failed_count: result.failed_count,
                skipped_count: result.skipped_count,
                log_lines: result.log_lines,
                result_summary: t(
                    'Done: formatted {0} file(s), {1} failed, {2} skipped.',
                    result.formatted_count,
                    result.failed_count,
                    result.skipped_count
                ),
            },
        });
    }

    private get_html_(webview: vscode.Webview): string {
        const nonce = get_webview_nonce();
        const ui = get_format_webview_strings();
        const ui_json = JSON.stringify(ui);
        const body = `
<style nonce="${nonce}">
#folderList {
    min-height: 72px;
    max-height: 132px;
    padding: 1px 0;
    line-height: 1.2;
    scrollbar-width: thin;
    scrollbar-color: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.4)) transparent;
}
#folderList::-webkit-scrollbar {
    width: 6px;
}
#folderList::-webkit-scrollbar-track {
    background: transparent;
}
#folderList::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.4));
}
#folderList::-webkit-scrollbar-thumb:hover {
    background: var(--vscode-scrollbarSlider-hoverBackground, rgba(121, 121, 121, 0.55));
}
.folder-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 6px;
    min-height: 18px;
    font-size: 0.88em;
    line-height: 1.2;
    cursor: pointer;
    user-select: none;
}
.folder-item:hover {
    background: var(--vscode-list-hoverBackground);
}
.folder-item input {
    margin: 0;
    width: 13px;
    height: 13px;
    flex: 0 0 13px;
}
.folder-item span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.toolbar {
    display: flex;
    gap: 6px;
    margin-bottom: var(--gap);
    flex-wrap: wrap;
}
.toolbar button.secondary {
    flex: 1 1 auto;
}
</style>
<p class="hint">${ui.workspace_label}<span id="workspaceRoot">${ui.workspace_not_open}</span></p>
<p class="hint">${ui.description}</p>
<label for="folderList">${ui.subfolders_label} <span class="badge" id="selectedCount">0</span></label>
<div class="list-box" id="folderList"></div>
<div class="toolbar">
    <button class="secondary" id="btnSelectAll">${ui.select_all}</button>
    <button class="secondary" id="btnClearAll">${ui.clear_all}</button>
    <button class="secondary" id="btnRefresh">${ui.refresh}</button>
</div>
<div class="actions">
    <button id="btnFormat">${ui.format_selected}</button>
</div>
<div class="log-box" id="logBox">${ui.waiting}</div>
<script nonce="${nonce}">
(function() {
    const vscode = acquireVsCodeApi();
    const ui = ${ui_json};
    const workspaceRoot = document.getElementById('workspaceRoot');
    const folderList = document.getElementById('folderList');
    const selectedCount = document.getElementById('selectedCount');
    const logBox = document.getElementById('logBox');
    let state = { subfolders: [], selected_subfolders: [] };
    let log_lines = [];

    function render_folders() {
        folderList.innerHTML = '';
        selectedCount.textContent = String(state.selected_subfolders.length);

        if (state.subfolders.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'folder-item';
            empty.textContent = ui.no_subfolders;
            folderList.appendChild(empty);
            return;
        }

        state.subfolders.forEach((folder) => {
            const label = document.createElement('label');
            label.className = 'folder-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = folder;
            checkbox.checked = state.selected_subfolders.includes(folder);
            checkbox.addEventListener('change', () => {
                const selected = new Set(state.selected_subfolders);
                if (checkbox.checked) {
                    selected.add(folder);
                } else {
                    selected.delete(folder);
                }
                state.selected_subfolders = state.subfolders.filter((item) => selected.has(item));
                selectedCount.textContent = String(state.selected_subfolders.length);
                vscode.postMessage({
                    type: 'updateSelection',
                    payload: { selected_subfolders: state.selected_subfolders },
                });
            });

            const text = document.createElement('span');
            text.textContent = folder;

            label.appendChild(checkbox);
            label.appendChild(text);
            folderList.appendChild(label);
        });
    }

    function render_log() {
        logBox.textContent = log_lines.length > 0 ? log_lines.join('\\n') : ui.waiting;
        logBox.scrollTop = logBox.scrollHeight;
    }

    window.addEventListener('message', (event) => {
        if (event.data.type === 'state') {
            workspaceRoot.textContent = event.data.payload.workspace_root || ui.workspace_not_open;
            state.subfolders = event.data.payload.subfolders || [];
            state.selected_subfolders = event.data.payload.selected_subfolders || [];
            render_folders();
        }
        if (event.data.type === 'clear_log') {
            log_lines = [];
            logBox.textContent = ui.formatting;
        }
        if (event.data.type === 'log_append') {
            log_lines.push(event.data.payload.line);
            render_log();
        }
        if (event.data.type === 'result') {
            const p = event.data.payload;
            log_lines = p.log_lines || log_lines;
            if (p.result_summary) {
                log_lines.push('');
                log_lines.push(p.result_summary);
            }
            render_log();
        }
    });

    document.getElementById('btnSelectAll').addEventListener('click', () => {
        vscode.postMessage({ type: 'selectAll' });
    });
    document.getElementById('btnClearAll').addEventListener('click', () => {
        vscode.postMessage({ type: 'clearAll' });
    });
    document.getElementById('btnRefresh').addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
    });
    document.getElementById('btnFormat').addEventListener('click', () => {
        vscode.postMessage({ type: 'format' });
    });

    vscode.postMessage({ type: 'ready' });
})();
</script>`;

        return wrap_webview_html(webview, body, nonce, { sidebar: true });
    }
}
