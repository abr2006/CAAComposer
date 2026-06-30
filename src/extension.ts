import * as vscode from 'vscode';
import { CaaBuilder } from './build/caa_builder';
import { CaaCatalogRegenerator } from './catalog/caa_catalog_regenerator';
import { register_build_commands } from './commands/build_commands';
import { register_catalog_commands } from './commands/catalog_commands';
import { register_tool_views } from './commands/tool_commands';
import { register_caa_sidebar } from './views/caa_sidebar_provider';

/**
 * 扩展激活入口
 */
export function activate(context: vscode.ExtensionContext): void {
    const output_channel = vscode.window.createOutputChannel('CAA Composer');
    const builder = new CaaBuilder(output_channel);
    const catalog_regenerator = new CaaCatalogRegenerator(builder, output_channel);

    register_build_commands(context, builder);
    register_tool_views(context, output_channel);
    const { provider: sidebar_provider, tree_view } = register_caa_sidebar(context);
    register_catalog_commands(context, tree_view, catalog_regenerator);
    context.subscriptions.push(output_channel);

    // 首次激活时自动打开侧边栏，便于 F5 调试时找到入口
    void vscode.commands.executeCommand('workbench.view.extension.caa-composer-sidebar');

    console.log('CAA Composer extension activated');
}

/**
 * 扩展停用
 */
export function deactivate(): void {}
