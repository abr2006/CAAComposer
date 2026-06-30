import * as vscode from 'vscode';
import { get_workspace_root } from '../config/caa_config';
import {
    attach_to_cnext,
    ensure_launch_json,
    pick_cnext_process_id,
} from '../debug/caa_debug_service';
import { t } from '../i18n/t';

/**
 * 注册 CNEXT 调试相关命令
 */
export function register_debug_commands(context: vscode.ExtensionContext): void {
    const setup_launch = vscode.commands.registerCommand('caa-composer.setupLaunchJson', async () => {
        const workspace_root = get_workspace_root();
        if (!workspace_root) {
            vscode.window.showErrorMessage(t('Open a CAA workspace folder first.'));
            return;
        }

        const updated = await ensure_launch_json(workspace_root);
        if (updated) {
            vscode.window.showInformationMessage(t('Updated .vscode/launch.json for CNEXT debugging.'));
        }
    });

    const attach_cnext = vscode.commands.registerCommand('caa-composer.attachCnext', async () => {
        const workspace_root = get_workspace_root();
        if (!workspace_root) {
            vscode.window.showErrorMessage(t('Open a CAA workspace folder first.'));
            return;
        }

        await attach_to_cnext(workspace_root);
    });

    const pick_cnext = vscode.commands.registerCommand('caa-composer.pickCnextProcess', async () => {
        return pick_cnext_process_id();
    });

    context.subscriptions.push(setup_launch, attach_cnext, pick_cnext);
}
