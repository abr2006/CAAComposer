import * as vscode from 'vscode';

/**
 * Localize a message (English source string; see l10n/bundle.l10n.*.json).
 */
export function t(message: string, ...args: Array<string | number | boolean>): string {
    return vscode.l10n.t(message, ...args);
}
