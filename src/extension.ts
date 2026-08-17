import * as vscode from 'vscode';
import { CaaBuilder } from './build/caa_builder';
import { CaaCatalogRegenerator } from './catalog/caa_catalog_regenerator';
import { register_build_commands } from './commands/build_commands';
import { register_catalog_commands } from './commands/catalog_commands';
import { register_debug_commands } from './commands/debug_commands';
import { register_format_commands } from './commands/format_commands';
import { register_tool_views } from './commands/tool_commands';
import { register_caa_sidebar } from './views/caa_sidebar_provider';
import { register_caa_status_bar } from './views/caa_status_bar';

/**
 * ��չ�������
 */
export function activate(context: vscode.ExtensionContext): void {
    const output_channel = vscode.window.createOutputChannel('CAA Composer');
    const builder = new CaaBuilder(output_channel);
    const catalog_regenerator = new CaaCatalogRegenerator(builder, output_channel);

    register_build_commands(context, builder, context.extensionPath);
    register_debug_commands(context);
    const { format_provider } = register_tool_views(context, output_channel);
    register_format_commands(context, format_provider);
    const { provider: sidebar_provider, tree_view } = register_caa_sidebar(context);
    register_catalog_commands(context, tree_view, catalog_regenerator);
    register_caa_status_bar(context);
    context.subscriptions.push(output_channel);

    console.log('CAA Composer extension activated');
}

/**
 * ��չͣ��
 */
export function deactivate(): void {}
