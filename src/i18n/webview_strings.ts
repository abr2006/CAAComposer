import { t } from './t';

export interface BuildlinkWebviewStrings {
    source_placeholder: string;
    target_placeholder: string;
    pick_folder_title: string;
    list_context_hint: string;
    open_git_button: string;
    open_git_hint: string;
}

export interface FormatWebviewStrings {
    workspace_label: string;
    workspace_not_open: string;
    subfolders_label: string;
    description: string;
    select_all: string;
    clear_all: string;
    refresh: string;
    format_selected: string;
    no_subfolders: string;
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
        open_git_button: t('Open Git Repos'),
        open_git_hint: t(
            'Briefly open files under Target symlinks so their Git repos appear in Source Control'
        ),
    };
}

export function get_format_webview_strings(): FormatWebviewStrings {
    return {
        workspace_label: t('Workspace:'),
        workspace_not_open: t('Not open'),
        subfolders_label: t('Subfolders'),
        description: t('Check subfolders under the workspace root to format their .cpp and .h files.'),
        select_all: t('Select all'),
        clear_all: t('Clear all'),
        refresh: t('Refresh'),
        format_selected: t('Format selected C++/H'),
        no_subfolders: t('No subfolders found in the workspace.'),
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
