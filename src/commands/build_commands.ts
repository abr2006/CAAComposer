import * as vscode from 'vscode';
import { CaaBuilder, BuildAction } from '../build/caa_builder';
import { get_caa_config, get_workspace_root } from '../config/caa_config';

/**
 * 注册 CAA 构建相关命令
 * @param context 扩展上下文
 * @param builder CAA 构建器
 */
export function register_build_commands(
    context: vscode.ExtensionContext,
    builder: CaaBuilder
): void {
    const commands: Array<{ id: string; action: BuildAction }> = [
        { id: 'caa-composer.build', action: 'build' },
        { id: 'caa-composer.testRun', action: 'test-run' },
        { id: 'caa-composer.clean', action: 'clean' },
    ];

    for (const command of commands) {
        const disposable = vscode.commands.registerCommand(command.id, async () => {
            const workspace_root = get_workspace_root();
            if (!workspace_root) {
                vscode.window.showErrorMessage(
                    '\u8bf7\u5148\u6253\u5f00 CAA \u5de5\u4f5c\u533a\u6587\u4ef6\u5939'
                );
                return;
            }

            const config = get_caa_config();
            await builder.run(command.action, workspace_root, config);
        });

        context.subscriptions.push(disposable);
    }
}
