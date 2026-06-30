import { t } from './t';

export interface BuildlinkWebviewStrings {
    source_placeholder: string;
    target_placeholder: string;
    pick_folder_title: string;
    list_context_hint: string;
}

export interface FormatWebviewStrings {
    workspace_label: string;
    workspace_not_open: string;
    description: string;
    format_all: string;
    waiting: string;
    formatting: string;
}

export interface CleanupWebviewStrings {
    workspace_label: string;
    workspace_not_open: string;
    description: string;
    column_win_b64: string;
    column_contents: string;
    refresh: string;
    empty: string;
    items_suffix: string;
    no_win_b64: string;
    waiting: string;
    result_summary: string;
}

export function get_buildlink_webview_strings(): BuildlinkWebviewStrings {
    return {
        source_placeholder: t('Source folder path'),
        target_placeholder: t('Target folder path'),
        pick_folder_title: t('Choose folder'),
        list_context_hint: t('Right-click list: Clear / Copy'),
    };
}

export function get_format_webview_strings(): FormatWebviewStrings {
    return {
        workspace_label: t('Workspace:'),
        workspace_not_open: t('Not open'),
        description: t(
            'Recursive clang-format on all .cpp and .h files in the workspace (uses .clang-format).'
        ),
        format_all: t('Format all C++/H files'),
        waiting: t('Waiting for action…'),
        formatting: t('Formatting C++ sources…'),
    };
}

export function get_cleanup_webview_strings(): CleanupWebviewStrings {
    return {
        workspace_label: t('Workspace:'),
        workspace_not_open: t('Not open'),
        description: t(
            'Find all win_b64 folders in the workspace and clear their contents (win_b64 folders are kept).'
        ),
        column_win_b64: t('win_b64'),
        column_contents: t('Contents'),
        refresh: t('Refresh'),
        empty: t('Empty'),
        items_suffix: t('item(s)'),
        no_win_b64: t('No win_b64 directories found'),
        waiting: t('Waiting for action…'),
        result_summary: t('Done: removed {0} item(s), {1} failure(s)'),
    };
}
