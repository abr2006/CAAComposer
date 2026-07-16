import * as vscode from 'vscode';
import { get_workspace_root } from '../config/caa_config';
import { t } from '../i18n/t';
import { is_caa_workspace_initialized } from '../workspace/caa_workspace_setup';

let refresh_status_bar_: (() => void) | undefined;

/**
 * 刷新右下角 Build / Run 状态栏按钮可见性
 */
export function refresh_caa_status_bar(): void {
    refresh_status_bar_?.();
}

/**
 * 注册右下角 CAA Build / Run 快捷按钮
 */
export function register_caa_status_bar(context: vscode.ExtensionContext): void {
    const build_item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
    build_item.command = 'caa-composer.build';
    build_item.text = `$(gear) ${t('CAA Build')}`;
    build_item.tooltip = t('Build current workspace');

    const run_item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    run_item.command = 'caa-composer.testRun';
    run_item.text = `$(play) ${t('CAA Run')}`;
    run_item.tooltip = t('Test run');

    const update_visibility_ = (): void => {
        const workspace_root = get_workspace_root();
        const visible = !!workspace_root && is_caa_workspace_initialized(workspace_root);

        build_item.text = `$(gear) ${t('CAA Build')}`;
        run_item.text = `$(play) ${t('CAA Run')}`;

        if (visible) {
            build_item.show();
            run_item.show();
        } else {
            build_item.hide();
            run_item.hide();
        }
    };

    refresh_status_bar_ = update_visibility_;
    update_visibility_();

    const refresh_command = vscode.commands.registerCommand(
        'caa-composer.refreshStatusBar',
        update_visibility_
    );

    context.subscriptions.push(build_item, run_item, refresh_command);

    vscode.workspace.onDidChangeWorkspaceFolders(() => update_visibility_());

    const vscode_config_watcher = vscode.workspace.createFileSystemWatcher('**/.vscode/**');
    for (const event of [
        vscode_config_watcher.onDidCreate,
        vscode_config_watcher.onDidChange,
        vscode_config_watcher.onDidDelete,
    ]) {
        event(() => update_visibility_());
    }
    context.subscriptions.push(vscode_config_watcher);
}
