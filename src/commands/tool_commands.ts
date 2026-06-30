import * as vscode from 'vscode';
import { BUILDLINK_VIEW_ID, BuildlinkViewProvider } from '../views/buildlink_view';
import { CLEANUP_VIEW_ID, CleanupViewProvider } from '../views/cleanup_view';
import { FORMAT_VIEW_ID, FormatViewProvider } from '../views/format_view';

const WEBVIEW_OPTIONS = {
    webviewOptions: { retainContextWhenHidden: true },
} as const;

export interface ToolViewProviders {
    cleanup_provider: CleanupViewProvider;
    format_provider: FormatViewProvider;
}

/**
 * 注册 Buildlink / ClearUp / Format 侧边栏 Webview 视图
 */
export function register_tool_views(
    context: vscode.ExtensionContext,
    output_channel: vscode.OutputChannel
): ToolViewProviders {
    const buildlink_provider = new BuildlinkViewProvider(context.globalState);
    const cleanup_provider = new CleanupViewProvider(output_channel);
    const format_provider = new FormatViewProvider(context.extensionPath, output_channel);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            BUILDLINK_VIEW_ID,
            buildlink_provider,
            WEBVIEW_OPTIONS
        ),
        vscode.window.registerWebviewViewProvider(
            CLEANUP_VIEW_ID,
            cleanup_provider,
            WEBVIEW_OPTIONS
        ),
        vscode.window.registerWebviewViewProvider(
            FORMAT_VIEW_ID,
            format_provider,
            WEBVIEW_OPTIONS
        ),
        vscode.commands.registerCommand('caa-composer.openBuildlink', () => {
            void BuildlinkViewProvider.focus();
        }),
        vscode.commands.registerCommand('caa-composer.openCleanup', () => {
            void CleanupViewProvider.focus();
        }),
        vscode.commands.registerCommand('caa-composer.openFormat', () => {
            void FormatViewProvider.focus();
        })
    );

    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        cleanup_provider.refresh_preview();
    });

    return { cleanup_provider, format_provider };
}
