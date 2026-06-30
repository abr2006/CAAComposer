import * as vscode from 'vscode';
import { CaaBuilder } from './build/caa_builder';
import { CaaCatalogRegenerator } from './catalog/caa_catalog_regenerator';
import { register_build_commands } from './commands/build_commands';
import { register_catalog_commands } from './commands/catalog_commands';
import { register_debug_commands } from './commands/debug_commands';
import { register_format_commands } from './commands/format_commands';
import { register_tool_views } from './commands/tool_commands';
import { auto_setup_launch_json_on_activate } from './debug/caa_debug_service';
import { auto_setup_clang_format_on_activate } from './format/caa_format_service';
import { register_caa_sidebar } from './views/caa_sidebar_provider';

/**
 * 扩展激活入口
 */
export function activate(context: vscode.ExtensionContext): void {
    const output_channel = vscode.window.createOutputChannel('CAA Composer');
    const builder = new CaaBuilder(output_channel);
    const catalog_regenerator = new CaaCatalogRegenerator(builder, output_channel);

    register_build_commands(context, builder);
    register_debug_commands(context);
    const { format_provider } = register_tool_views(context, output_channel);
    register_format_commands(context, format_provider);
    const { provider: sidebar_provider, tree_view } = register_caa_sidebar(context);
    register_catalog_commands(context, tree_view, catalog_regenerator);
    context.subscriptions.push(output_channel);

    void auto_setup_launch_json_on_activate();
    void auto_setup_clang_format_on_activate(context.extensionPath);

    // 首次激活时自动打开侧边栏，便于 F5 调试时找到入口
    void vscode.commands.executeCommand('workbench.view.extension.caa-composer-sidebar');

    console.log('CAA Composer extension activated');
}

/**
 * 扩展停用
 */
export function deactivate(): void {}
