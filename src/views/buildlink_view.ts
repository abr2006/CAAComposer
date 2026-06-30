import * as vscode from 'vscode';
import {
    DEFAULT_BUILDLINK_BAN_WORDS,
    DEFAULT_BUILDLINK_FILTER,
    fetch_buildlink_folders,
    generate_buildlink_symlinks,
    get_mklink_privilege_help,
    resolve_buildlink_full_path,
} from '../tools/buildlink_service';
import { get_workspace_root } from '../config/caa_config';
import { t } from '../i18n/t';
import { get_buildlink_webview_strings } from '../i18n/webview_strings';
import { get_webview_nonce, pick_folder_dialog, wrap_webview_html } from './webview_utils';

export const BUILDLINK_VIEW_ID = 'caaComposer.buildlink';
const STATE_KEY = 'caaComposer.buildlinkState';

interface BuildlinkState {
    source_path: string;
    target_path: string;
    filter_text: string;
    ban_words_text: string;
    folder_list: string[];
}

/**
 * Buildlink 工具侧边栏 Webview
 */
export class BuildlinkViewProvider implements vscode.WebviewViewProvider {
    private view_?: vscode.WebviewView;
    private state_: BuildlinkState;

    constructor(private readonly global_state_: vscode.Memento) {
        this.state_ = BuildlinkViewProvider.load_state_(global_state_);
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
     * 聚焦侧边栏 Buildlink 视图
     */
    static async focus(): Promise<void> {
        await vscode.commands.executeCommand('workbench.view.extension.caa-composer-sidebar');
        await vscode.commands.executeCommand(`${BUILDLINK_VIEW_ID}.focus`);
    }

    private static load_state_(global_state: vscode.Memento): BuildlinkState {
        const saved = global_state.get<BuildlinkState>(STATE_KEY);
        const workspace_root = get_workspace_root() ?? '';

        return {
            source_path: saved?.source_path ?? workspace_root,
            target_path: saved?.target_path ?? '',
            filter_text: saved?.filter_text ?? DEFAULT_BUILDLINK_FILTER,
            ban_words_text: saved?.ban_words_text ?? DEFAULT_BUILDLINK_BAN_WORDS,
            folder_list: saved?.folder_list ?? [],
        };
    }

    private save_state_(): void {
        void this.global_state_.update(STATE_KEY, this.state_);
    }

    private post_state_(): void {
        void this.view_?.webview.postMessage({
            type: 'state',
            payload: this.state_,
        });
    }

    private async handle_message_(message: { type: string; payload?: unknown }): Promise<void> {
        switch (message.type) {
            case 'ready':
                this.post_state_();
                break;
            case 'updateField': {
                const payload = message.payload as { field: keyof BuildlinkState; value: string };
                if (
                    payload.field === 'source_path' ||
                    payload.field === 'target_path' ||
                    payload.field === 'filter_text' ||
                    payload.field === 'ban_words_text'
                ) {
                    this.state_[payload.field] = payload.value;
                    this.state_.folder_list = [];
                    this.save_state_();
                    this.post_state_();
                }
                break;
            }
            case 'pickSource': {
                const picked = await pick_folder_dialog(
                    this.state_.source_path ? vscode.Uri.file(this.state_.source_path) : undefined
                );
                if (picked) {
                    this.state_.source_path = picked;
                    this.state_.folder_list = [];
                    this.save_state_();
                    this.post_state_();
                }
                break;
            }
            case 'pickTarget': {
                const picked = await pick_folder_dialog(
                    this.state_.target_path ? vscode.Uri.file(this.state_.target_path) : undefined
                );
                if (picked) {
                    this.state_.target_path = picked;
                    this.save_state_();
                    this.post_state_();
                }
                break;
            }
            case 'fetch': {
                if (!this.state_.source_path.trim()) {
                    vscode.window.showWarningMessage(t('Select a source folder path first.'));
                    break;
                }
                try {
                    this.state_.folder_list = fetch_buildlink_folders(
                        this.state_.source_path,
                        this.state_.filter_text,
                        this.state_.ban_words_text
                    );
                    this.save_state_();
                    this.post_state_();
                    vscode.window.showInformationMessage(
                        t('Found {0} matching folder(s).', this.state_.folder_list.length)
                    );
                } catch (error) {
                    const text = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(t('Error while searching folders: {0}', text));
                }
                break;
            }
            case 'generate': {
                if (this.state_.folder_list.length === 0) {
                    vscode.window.showWarningMessage(t('No symlinks to generate.'));
                    break;
                }
                if (!this.state_.source_path.trim() || !this.state_.target_path.trim()) {
                    vscode.window.showWarningMessage(t('Set Source and Target paths first.'));
                    break;
                }
                const result = generate_buildlink_symlinks(
                    this.state_.source_path,
                    this.state_.target_path,
                    this.state_.folder_list
                );
                let message = t(
                    'Done. Success: {0}, failed: {1}',
                    result.success_count,
                    result.fail_count
                );
                if (result.fail_messages.length > 0) {
                    message +=
                        '\n\n' + t('Failure details:\n{0}', result.fail_messages.join('\n'));
                }
                if (result.privilege_denied) {
                    message += '\n\n' + get_mklink_privilege_help();
                }
                if (result.fail_count === 0) {
                    vscode.window.showInformationMessage(message);
                } else {
                    vscode.window.showWarningMessage(message);
                }
                break;
            }
            case 'clearSelected': {
                const indices = (message.payload as { indices: number[] }).indices ?? [];
                for (const index of [...indices].sort((a, b) => b - a)) {
                    this.state_.folder_list.splice(index, 1);
                }
                this.save_state_();
                this.post_state_();
                break;
            }
            case 'clearAll':
                this.state_.folder_list = [];
                this.save_state_();
                this.post_state_();
                break;
            case 'copySelected': {
                const index = (message.payload as { index: number }).index;
                if (index < 0 || index >= this.state_.folder_list.length) {
                    break;
                }
                const full_path = resolve_buildlink_full_path(
                    this.state_.source_path,
                    this.state_.folder_list[index]
                );
                await vscode.env.clipboard.writeText(full_path);
                vscode.window.showInformationMessage(t('Full path copied to clipboard.'));
                break;
            }
            case 'copyAll': {
                if (this.state_.folder_list.length === 0) {
                    vscode.window.showWarningMessage(t('No paths to copy.'));
                    break;
                }
                await vscode.env.clipboard.writeText(this.state_.folder_list.join('\n'));
                vscode.window.showInformationMessage(
                    t('Copied {0} path(s) to clipboard.', this.state_.folder_list.length)
                );
                break;
            }
        }
    }

    private get_html_(webview: vscode.Webview): string {
        const nonce = get_webview_nonce();
        const ui = get_buildlink_webview_strings();
        const body = `
<div class="row">
    <label for="source">Source</label>
    <input type="text" id="source" placeholder="${ui.source_placeholder}">
    <button class="secondary" id="btnOpenSource" title="${ui.pick_folder_title}">…</button>
</div>
<div class="row">
    <label for="target">Target</label>
    <input type="text" id="target" placeholder="${ui.target_placeholder}">
    <button class="secondary" id="btnOpenTarget" title="${ui.pick_folder_title}">…</button>
</div>
<div class="row">
    <label for="filter">Filter</label>
    <input type="text" id="filter" placeholder="*.Frm,*.Interfaces,*.Tlb">
</div>
<div class="row">
    <label for="banWords">Ban</label>
    <input type="text" id="banWords" placeholder="PNX*">
</div>
<label for="listBox">SourceFrm <span class="badge" id="countBadge">0</span></label>
<div class="list-box" id="listBox"></div>
<p class="hint">${ui.list_context_hint}</p>
<div class="actions">
    <button id="btnFetch">Fetch</button>
    <button id="btnGenerate">Generate</button>
</div>
<script nonce="${nonce}">
(function() {
    const vscode = acquireVsCodeApi();
    let state = { source_path: '', target_path: '', filter_text: '', ban_words_text: '', folder_list: [] };
    let selectedIndices = new Set();

    const sourceInput = document.getElementById('source');
    const targetInput = document.getElementById('target');
    const filterInput = document.getElementById('filter');
    const banWordsInput = document.getElementById('banWords');
    const listBox = document.getElementById('listBox');
    const countBadge = document.getElementById('countBadge');
    const btnFetch = document.getElementById('btnFetch');
    const btnGenerate = document.getElementById('btnGenerate');

    function render() {
        sourceInput.value = state.source_path || '';
        targetInput.value = state.target_path || '';
        filterInput.value = state.filter_text || '';
        banWordsInput.value = state.ban_words_text || '';
        countBadge.textContent = String(state.folder_list.length);
        listBox.innerHTML = '';
        state.folder_list.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'list-item' + (selectedIndices.has(index) ? ' selected' : '');
            div.textContent = item;
            div.dataset.index = String(index);
            div.addEventListener('click', (e) => {
                const idx = Number(div.dataset.index);
                if (e.ctrlKey || e.metaKey) {
                    if (selectedIndices.has(idx)) selectedIndices.delete(idx);
                    else selectedIndices.add(idx);
                } else if (e.shiftKey && selectedIndices.size > 0) {
                    const last = Math.max(...selectedIndices);
                    const start = Math.min(last, idx);
                    const end = Math.max(last, idx);
                    for (let i = start; i <= end; i++) selectedIndices.add(i);
                } else {
                    selectedIndices.clear();
                    selectedIndices.add(idx);
                }
                render();
            });
            listBox.appendChild(div);
        });
        btnFetch.disabled = !state.source_path.trim();
        btnGenerate.disabled = !state.target_path.trim() || state.folder_list.length === 0;
    }

    window.addEventListener('message', (event) => {
        if (event.data.type === 'state') {
            state = event.data.payload;
            selectedIndices.clear();
            render();
        }
    });

    sourceInput.addEventListener('change', () => {
        vscode.postMessage({ type: 'updateField', payload: { field: 'source_path', value: sourceInput.value } });
    });
    targetInput.addEventListener('change', () => {
        vscode.postMessage({ type: 'updateField', payload: { field: 'target_path', value: targetInput.value } });
    });
    filterInput.addEventListener('change', () => {
        vscode.postMessage({ type: 'updateField', payload: { field: 'filter_text', value: filterInput.value } });
    });
    banWordsInput.addEventListener('change', () => {
        vscode.postMessage({ type: 'updateField', payload: { field: 'ban_words_text', value: banWordsInput.value } });
    });

    document.getElementById('btnOpenSource').addEventListener('click', () => vscode.postMessage({ type: 'pickSource' }));
    document.getElementById('btnOpenTarget').addEventListener('click', () => vscode.postMessage({ type: 'pickTarget' }));
    btnFetch.addEventListener('click', () => vscode.postMessage({ type: 'fetch' }));
    btnGenerate.addEventListener('click', () => vscode.postMessage({ type: 'generate' }));

    listBox.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const menu = document.createElement('div');
        menu.className = 'ctx-menu';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        const items = [
            { label: 'Clear', action: () => {
                if (selectedIndices.size === 0) return;
                vscode.postMessage({ type: 'clearSelected', payload: { indices: [...selectedIndices] } });
            }},
            { label: 'Clear All', action: () => vscode.postMessage({ type: 'clearAll' }) },
            { label: 'Copy', action: () => {
                if (selectedIndices.size === 0) return;
                vscode.postMessage({ type: 'copySelected', payload: { index: Math.min(...selectedIndices) } });
            }},
            { label: 'Copy All', action: () => vscode.postMessage({ type: 'copyAll' }) },
        ];
        items.forEach(({ label, action }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.className = 'ctx-item';
            btn.addEventListener('click', () => { action(); document.body.removeChild(menu); });
            menu.appendChild(btn);
        });
        document.body.appendChild(menu);
        const close = () => { if (menu.parentNode) menu.parentNode.removeChild(menu); document.removeEventListener('click', close); };
        setTimeout(() => document.addEventListener('click', close), 0);
    });

    vscode.postMessage({ type: 'ready' });
})();
</script>`;

        return wrap_webview_html(webview, body, nonce, { sidebar: true });
    }
}
