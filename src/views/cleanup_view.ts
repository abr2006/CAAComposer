import * as vscode from 'vscode';
import { get_workspace_root } from '../config/caa_config';
import { preview_cleanup_targets, run_win_b64_full_cleanup } from '../tools/cleanup_service';
import { get_webview_nonce, wrap_webview_html } from './webview_utils';

export const CLEANUP_VIEW_ID = 'caaComposer.cleanup';

/**
 * ClearUp 侧边栏 Webview
 */
export class CleanupViewProvider implements vscode.WebviewViewProvider {
    private view_?: vscode.WebviewView;

    constructor(private readonly output_channel_: vscode.OutputChannel) {}

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
                this.post_preview_();
            }
        });
    }

    /**
     * 刷新清理预览
     */
    refresh_preview(): void {
        this.post_preview_();
    }

    /**
     * 聚焦侧边栏 ClearUp 视图
     */
    static async focus(): Promise<void> {
        await vscode.commands.executeCommand('workbench.view.extension.caa-composer-sidebar');
        await vscode.commands.executeCommand(`${CLEANUP_VIEW_ID}.focus`);
    }

    private post_preview_(): void {
        const workspace_root = get_workspace_root();
        if (!workspace_root) {
            void this.view_?.webview.postMessage({
                type: 'preview',
                payload: { workspace_root: '', items: [] },
            });
            return;
        }

        const items = preview_cleanup_targets(workspace_root);
        void this.view_?.webview.postMessage({
            type: 'preview',
            payload: { workspace_root, items },
        });
    }

    private async handle_message_(message: { type: string }): Promise<void> {
        switch (message.type) {
            case 'ready':
            case 'refresh':
                this.post_preview_();
                break;
            case 'cleanup': {
                const workspace_root = get_workspace_root();
                if (!workspace_root) {
                    vscode.window.showErrorMessage('请先打开 CAA 工作区文件夹');
                    break;
                }

                const confirm = await vscode.window.showWarningMessage(
                    '确定清空工作区内所有 win_b64 目录下的内容？（保留 win_b64 文件夹）',
                    { modal: true },
                    '确定'
                );
                if (confirm !== '确定') {
                    break;
                }

                this.output_channel_.appendLine(`[CAA Composer] 工作区: ${workspace_root}`);
                this.output_channel_.appendLine('[CAA Composer] 动作: ClearUp（清空 win_b64）');
                this.output_channel_.appendLine('---');

                const result = run_win_b64_full_cleanup(workspace_root);
                for (const line of result.log_lines) {
                    this.output_channel_.appendLine(line);
                }
                this.output_channel_.appendLine('---');
                this.output_channel_.appendLine(
                    `[信息] ClearUp 完成（${result.removed_count} 项）`
                );
                this.output_channel_.show(true);

                void this.view_?.webview.postMessage({
                    type: 'result',
                    payload: {
                        success: result.success,
                        removed_count: result.removed_count,
                        error_count: result.error_count,
                        log_lines: result.log_lines,
                    },
                });

                if (result.success) {
                    vscode.window.showInformationMessage(
                        `ClearUp 完成（${result.removed_count} 项）`
                    );
                } else {
                    vscode.window.showWarningMessage(
                        `删除完成，${result.error_count} 项失败`
                    );
                }

                this.post_preview_();
                break;
            }
        }
    }

    private get_html_(webview: vscode.Webview): string {
        const nonce = get_webview_nonce();
        const body = `
<p class="hint">工作区：<span id="workspaceRoot">未打开</span></p>
<p class="hint">查找工作区内所有 win_b64，清空其内部内容（保留 win_b64 目录）。</p>
<div class="preview-wrap">
<table class="preview-table">
    <thead>
        <tr><th>win_b64</th><th>内容</th></tr>
    </thead>
    <tbody id="previewBody"></tbody>
</table>
</div>
<div class="actions">
    <button id="btnRefresh" class="secondary">刷新</button>
    <button id="btnCleanup">Clean Up</button>
</div>
<div class="log-box" id="logBox">等待操作…</div>
<script nonce="${nonce}">
(function() {
    const vscode = acquireVsCodeApi();
    const workspaceRoot = document.getElementById('workspaceRoot');
    const previewBody = document.getElementById('previewBody');
    const logBox = document.getElementById('logBox');

    function renderPreview(payload) {
        workspaceRoot.textContent = payload.workspace_root || '未打开';
        previewBody.innerHTML = '';
        (payload.items || []).forEach((item) => {
            const tr = document.createElement('tr');
            const status = item.entry_count > 0 ? item.entry_count + ' 项' : '空';
            tr.innerHTML = '<td title="' + item.relative_path + '">' + item.relative_path + '</td><td>' + status + '</td>';
            previewBody.appendChild(tr);
        });
        if (!payload.items || payload.items.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="2" class="missing">未找到 win_b64 目录</td>';
            previewBody.appendChild(tr);
        }
    }

    window.addEventListener('message', (event) => {
        if (event.data.type === 'preview') {
            renderPreview(event.data.payload);
        }
        if (event.data.type === 'result') {
            const p = event.data.payload;
            logBox.textContent = p.log_lines.join('\\n') +
                '\\n\\n完成：删除 ' + p.removed_count + ' 项，失败 ' + p.error_count + ' 项';
        }
    });

    document.getElementById('btnRefresh').addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
    });
    document.getElementById('btnCleanup').addEventListener('click', () => {
        vscode.postMessage({ type: 'cleanup' });
    });

    vscode.postMessage({ type: 'ready' });
})();
</script>`;

        return wrap_webview_html(webview, body, nonce, { sidebar: true });
    }
}
