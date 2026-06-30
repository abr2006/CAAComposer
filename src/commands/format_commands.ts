import * as vscode from 'vscode';
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
            await format_provider.run_format();
        }
    );

    context.subscriptions.push(format_all_command);
}
