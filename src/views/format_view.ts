import * as vscode from 'vscode';
import { get_workspace_root } from '../config/caa_config';
import { format_all_cpp_sources } from '../format/caa_format_service';
import { t } from '../i18n/t';
import { get_format_webview_strings } from '../i18n/webview_strings';
import { get_webview_nonce, wrap_webview_html } from './webview_utils';

export const FORMAT_VIEW_ID = 'caaComposer.format';

/**
 * Format 侧边栏 Webview（批量 clang-format 与日志）
 */
export class FormatViewProvider implements vscode.WebviewViewProvider {
    private view_?: vscode.WebviewView;

    constructor(
        private readonly extension_path_: string,
        private readonly output_channel_: vscode.OutputChannel
    ) {}

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
                this.post_workspace_();
            }
        });
    }

    /**
     * 执行批量格式化并更新 Webview 日志
     */
    async run_format(): Promise<void> {
        await FormatViewProvider.focus();
        await this.execute_format_();
    }

    /**
     * 聚焦侧边栏 Format 视图
     */
    static async focus(): Promise<void> {
        await vscode.commands.executeCommand('workbench.view.extension.caa-composer-sidebar');
        await vscode.commands.executeCommand(`${FORMAT_VIEW_ID}.focus`);
    }

    private post_workspace_(): void {
        const workspace_root = get_workspace_root();
        void this.view_?.webview.postMessage({
            type: 'workspace',
            payload: { workspace_root: workspace_root ?? '' },
        });
    }

    private async handle_message_(message: { type: string }): Promise<void> {
        switch (message.type) {
            case 'ready':
                this.post_workspace_();
                break;
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

        void this.view_?.webview.postMessage({ type: 'clear_log' });

        const append_to_webview = (line: string): void => {
            this.output_channel_.appendLine(line);
            void this.view_?.webview.postMessage({
                type: 'log_append',
                payload: { line },
            });
        };

        const result = await format_all_cpp_sources(workspace_root, this.extension_path_, {
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
<p class="hint">${ui.workspace_label}<span id="workspaceRoot">${ui.workspace_not_open}</span></p>
<p class="hint">${ui.description}</p>
<div class="actions">
    <button id="btnFormat">${ui.format_all}</button>
</div>
<div class="log-box" id="logBox">${ui.waiting}</div>
<script nonce="${nonce}">
(function() {
    const vscode = acquireVsCodeApi();
    const ui = ${ui_json};
    const workspaceRoot = document.getElementById('workspaceRoot');
    const logBox = document.getElementById('logBox');
    let log_lines = [];

    function render_log() {
        logBox.textContent = log_lines.length > 0 ? log_lines.join('\\n') : ui.waiting;
        logBox.scrollTop = logBox.scrollHeight;
    }

    window.addEventListener('message', (event) => {
        if (event.data.type === 'workspace') {
            workspaceRoot.textContent = event.data.payload.workspace_root || ui.workspace_not_open;
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

    document.getElementById('btnFormat').addEventListener('click', () => {
        vscode.postMessage({ type: 'format' });
    });

    vscode.postMessage({ type: 'ready' });
})();
</script>`;

        return wrap_webview_html(webview, body, nonce, { sidebar: true });
    }
}
