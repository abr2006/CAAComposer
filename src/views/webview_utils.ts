import * as vscode from 'vscode';
import { t } from '../i18n/t';

/**
 * 生成 Webview CSP nonce
 */
export function get_webview_nonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * 包装 Webview HTML，注入 VS Code 主题变量样式
 */
export function wrap_webview_html(
    webview: vscode.Webview,
    body_html: string,
    nonce: string,
    options?: { sidebar?: boolean }
): string {
    const sidebar = options?.sidebar === true;
    const layout_css = sidebar
        ? `
html, body { height: 100%; }
body {
    padding: 8px 10px 12px;
    background: var(--vscode-sideBar-background);
    overflow-x: hidden;
    overflow-y: auto;
}
.row label { flex: 0 0 52px; font-size: 0.92em; }
.row input[type="text"] { min-width: 0; font-size: 0.92em; padding: 4px 6px; }
button { padding: 4px 10px; font-size: 0.92em; }
button.secondary { flex: 0 0 28px; padding: 4px 0; }
.list-box { min-height: 88px; max-height: 160px; }
.log-box { min-height: 64px; max-height: 120px; font-size: 0.85em; }
.preview-wrap { overflow-x: auto; max-height: 140px; overflow-y: auto; }
.preview-table { font-size: 0.85em; }
.preview-table td { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctx-menu {
    position: fixed;
    background: var(--vscode-menu-background);
    border: 1px solid var(--vscode-menu-border);
    border-radius: 4px;
    padding: 4px 0;
    z-index: 1000;
    min-width: 120px;
}
.ctx-item {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 6px 12px;
    color: var(--vscode-menu-foreground);
}
.ctx-item:hover { background: var(--vscode-menu-selectionBackground); }
`
        : '';
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
:root {
    --gap: 12px;
    --radius: 4px;
}
* { box-sizing: border-box; }
body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 16px;
    margin: 0;
}
h1 {
    font-size: 1.2em;
    font-weight: 600;
    margin: 0 0 16px 0;
}
label {
    display: block;
    margin-bottom: 4px;
    color: var(--vscode-descriptionForeground);
}
.row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: var(--gap);
}
.row label {
    flex: 0 0 100px;
    margin: 0;
}
.row input[type="text"] {
    flex: 1;
}
input[type="text"], textarea, select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: var(--radius);
    padding: 6px 8px;
    font-family: inherit;
    font-size: inherit;
}
textarea, .list-box {
    width: 100%;
    min-height: 180px;
    resize: vertical;
}
.list-box {
    overflow: auto;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: var(--radius);
    padding: 4px 0;
}
.list-item {
    padding: 4px 8px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
}
.list-item.selected {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
.list-item:hover:not(.selected) {
    background: var(--vscode-list-hoverBackground);
}
button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: var(--radius);
    padding: 6px 14px;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
}
button:hover { background: var(--vscode-button-hoverBackground); }
button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: var(--gap);
}
.hint {
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
    margin: 8px 0;
}
.log-box {
    margin-top: var(--gap);
    padding: 8px;
    min-height: 120px;
    max-height: 240px;
    overflow: auto;
    background: var(--vscode-textCodeBlock-background);
    border-radius: var(--radius);
    font-family: var(--vscode-editor-font-family);
    font-size: 0.9em;
    white-space: pre-wrap;
}
.badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.85em;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
}
.preview-table {
    width: 100%;
    border-collapse: collapse;
    margin: var(--gap) 0;
}
.preview-table th, .preview-table td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--vscode-panel-border, #444);
}
.preview-table th {
    color: var(--vscode-descriptionForeground);
    font-weight: 600;
}
.missing { color: var(--vscode-descriptionForeground); }
${layout_css}
</style>
</head>
<body>
${body_html}
</body>
</html>`;
}

/**
 * 选择文件夹对话框
 */
export async function pick_folder_dialog(default_uri?: vscode.Uri): Promise<string | undefined> {
    const result = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: default_uri,
        openLabel: t('Choose folder'),
    });

    if (!result || result.length === 0) {
        return undefined;
    }

    return result[0].fsPath;
}
