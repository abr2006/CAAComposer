import * as vscode from 'vscode';
import { get_workspace_root } from '../config/caa_config';
import { list_workspace_format_subfolders } from '../format/caa_format_service';
import { t } from '../i18n/t';
import { FormatViewProvider } from '../views/format_view';

/**
 * 注册 clang-format 相关命令
 */
export function register_format_commands(
    context: vscode.ExtensionContext,
    format_provider: FormatViewProvider
): void {
    const format_all_command = vscode.commands.registerCommand(
        'caa-composer.formatAllCpp',
        async () => {
            const workspace_root = get_workspace_root();
            if (!workspace_root) {
                vscode.window.showErrorMessage(t('Open a CAA workspace folder first.'));
                return;
            }

            const subfolders = list_workspace_format_subfolders(workspace_root);
            if (subfolders.length === 0) {
                vscode.window.showInformationMessage(t('No subfolders found in the workspace.'));
                return;
            }

            const selected = await vscode.window.showQuickPick(
                subfolders.map((label) => ({ label, picked: true })),
                {
                    canPickMany: true,
                    title: t('Select subfolders to format'),
                    placeHolder: t('Choose one or more subfolders'),
                }
            );

            if (!selected || selected.length === 0) {
                return;
            }

            await format_provider.run_format(selected.map((item) => item.label));
        }
    );

    context.subscriptions.push(format_all_command);
}
