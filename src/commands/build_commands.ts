import * as vscode from 'vscode';
import { CaaBuilder, BuildAction } from '../build/caa_builder';
import { get_caa_config, get_workspace_root } from '../config/caa_config';
import { prepare_and_attach_after_test_run } from '../debug/caa_debug_service';
import { t } from '../i18n/t';

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
                vscode.window.showErrorMessage(t('Open a CAA workspace folder first.'));
                return;
            }

            const config = get_caa_config();
            const result = await builder.run(command.action, workspace_root, config);

            if (command.action === 'test-run' && result.success) {
                void prepare_and_attach_after_test_run(workspace_root);
            }
        });

        context.subscriptions.push(disposable);
    }
}
