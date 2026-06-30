import * as vscode from 'vscode';
import { CaaCatalogRegenerator } from '../catalog/caa_catalog_regenerator';
import { CaaComposerConfig, get_caa_config, get_workspace_root } from '../config/caa_config';
import { t } from '../i18n/t';
import { CaaTreeItem } from '../views/caa_sidebar_provider';

/**
 * 解析 Catalog 命令目标树节点
 */
function resolve_catalog_tree_item_(
    item: CaaTreeItem | undefined,
    tree_view: vscode.TreeView<CaaTreeItem>
): CaaTreeItem | undefined {
    if (item?.catalog_entry_) {
        return item;
    }
    return tree_view.selection.find((node) => node.catalog_entry_ !== undefined);
}

/**
 * 执行 Catalog 行内命令
 */
async function run_catalog_command_(
    item: CaaTreeItem | undefined,
    tree_view: vscode.TreeView<CaaTreeItem>,
    runner: (
        module_name: string,
        workspace_root: string,
        config: CaaComposerConfig
    ) => Promise<unknown>
): Promise<void> {
    const target = resolve_catalog_tree_item_(item, tree_view);
    if (!target?.catalog_entry_) {
        vscode.window.showErrorMessage(t('Select a module in the Catalog list first.'));
        return;
    }

    const workspace_root = get_workspace_root();
    if (!workspace_root) {
        vscode.window.showErrorMessage(t('Open a CAA workspace folder first.'));
        return;
    }

    const config = get_caa_config();
    await runner(target.catalog_entry_.module_name, workspace_root, config);
}

/**
 * 注册 Catalog 行内操作命令
 * @param context 扩展上下文
 * @param tree_view Catalog 树视图
 * @param regenerator Catalog 执行器
 */
export function register_catalog_commands(
    context: vscode.ExtensionContext,
    tree_view: vscode.TreeView<CaaTreeItem>,
    regenerator: CaaCatalogRegenerator
): void {
    const stub_commands = [
        'caa-composer.catalog.statusMissing',
        'caa-composer.catalog.statusNeedRepair',
    ];

    for (const command_id of stub_commands) {
        const disposable = vscode.commands.registerCommand(
            command_id,
            (_item: CaaTreeItem | undefined) => {
                // 预留：状态图标占位命令
            }
        );
        context.subscriptions.push(disposable);
    }

    const regenerate_command = vscode.commands.registerCommand(
        'caa-composer.catalog.regenerate',
        (item: CaaTreeItem | undefined) =>
            run_catalog_command_(item, tree_view, (module_name, workspace_root, config) =>
                regenerator.regenerate(module_name, workspace_root, config)
            )
    );

    const update_command = vscode.commands.registerCommand(
        'caa-composer.catalog.update',
        (item: CaaTreeItem | undefined) =>
            run_catalog_command_(item, tree_view, (module_name, workspace_root, config) =>
                regenerator.update(module_name, workspace_root, config)
            )
    );

    const repair_command = vscode.commands.registerCommand(
        'caa-composer.catalog.repair',
        (item: CaaTreeItem | undefined) =>
            run_catalog_command_(item, tree_view, (module_name, workspace_root, config) =>
                regenerator.repair(module_name, workspace_root, config)
            )
    );

    context.subscriptions.push(regenerate_command, update_command, repair_command);
}
