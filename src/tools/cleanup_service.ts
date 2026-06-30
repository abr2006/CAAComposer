import * as fs from 'fs';
import * as path from 'path';
import { t } from '../i18n/t';

const WIN_B64_DIR_NAME = 'win_b64';

/** win_b64/code/bin 下需删除的扩展名（删除构建产物） */
const BUILD_ARTIFACT_BIN_EXTENSIONS = new Set(['.exp', '.lib', '.exe', '.pdb']);

/** 删除构建产物：需递归删除的相对目录（相对工作区根目录） */
const BUILD_ARTIFACT_TARGET_FOLDERS: string[][] = [
    ['win_b64', 'control'],
    ['win_b64', 'code', 'lib'],
    ['win_b64', 'code', 'productIC'],
    ['win_b64', 'resources', 'msgcatalog', 'DbcsTest'],
    ['win_b64', 'resources', 'msgcatalog', 'NlsTest'],
    ['win_b64', 'resources', 'knowledge'],
];

export interface CleanupPreviewItem {
    relative_path: string;
    entry_count: number;
    exists: boolean;
}

export interface CleanupResult {
    success: boolean;
    removed_count: number;
    error_count: number;
    log_lines: string[];
}

/**
 * 在工作区内递归查找所有 win_b64 目录（ClearUp 用）
 * @param workspace_root 工作区根目录
 */
export function find_win_b64_directories(workspace_root: string): string[] {
    const results: string[] = [];
    find_win_b64_directories_(workspace_root, results);
    return results.sort((a, b) => a.localeCompare(b));
}

/**
 * 预览 ClearUp 将要清空的 win_b64 目录
 * @param workspace_root 工作区根目录
 */
export function preview_cleanup_targets(workspace_root: string): CleanupPreviewItem[] {
    return find_win_b64_directories(workspace_root).map((win_b64_path) => {
        const relative_path = path.relative(workspace_root, win_b64_path);
        let entry_count = 0;

        try {
            entry_count = fs.readdirSync(win_b64_path).length;
        } catch {
            entry_count = 0;
        }

        return {
            relative_path: relative_path + path.sep,
            entry_count,
            exists: true,
        };
    });
}

/**
 * ClearUp：清空工作区内所有 win_b64 目录内容（保留 win_b64 本身）
 * @param workspace_root 工作区根目录
 */
export function run_win_b64_full_cleanup(workspace_root: string): CleanupResult {
    const log_lines: string[] = [];
    let removed_count = 0;
    let error_count = 0;

    const win_b64_dirs = find_win_b64_directories(workspace_root);
    if (win_b64_dirs.length === 0) {
        log_lines.push(t('[Skip] No win_b64 directories found'));
        return {
            success: true,
            removed_count: 0,
            error_count: 0,
            log_lines,
        };
    }

    for (const win_b64_path of win_b64_dirs) {
        const relative_win_b64 = path.relative(workspace_root, win_b64_path);
        log_lines.push(t('[Clean] {0}', `${relative_win_b64}${path.sep}`));

        let entries: string[];
        try {
            entries = fs.readdirSync(win_b64_path);
        } catch (error) {
            error_count++;
            const message = error instanceof Error ? error.message : String(error);
            log_lines.push(t('[Fail] Cannot read {0}: {1}', relative_win_b64, message));
            continue;
        }

        if (entries.length === 0) {
            log_lines.push(t('[Skip] Directory already empty'));
            continue;
        }

        for (const entry of entries) {
            const entry_path = path.join(win_b64_path, entry);
            const relative_entry = path.relative(workspace_root, entry_path);
            try {
                fs.rmSync(entry_path, { recursive: true, force: true });
                removed_count++;
                log_lines.push(t('[Delete] {0}', relative_entry));
            } catch (error) {
                error_count++;
                const message = error instanceof Error ? error.message : String(error);
                log_lines.push(t('[Fail] {0}: {1}', relative_entry, message));
            }
        }
    }

    return {
        success: error_count === 0,
        removed_count,
        error_count,
        log_lines,
    };
}

/**
 * 删除构建产物：清理工作区根下 win_b64\code\bin 指定扩展名及固定目录
 * @param workspace_root 工作区根目录
 */
export function run_build_artifacts_cleanup(workspace_root: string): CleanupResult {
    const log_lines: string[] = [];
    let removed_count = 0;
    let error_count = 0;

    const bin_dir = path.join(workspace_root, 'win_b64', 'code', 'bin');

    if (fs.existsSync(bin_dir)) {
        for (const entry of fs.readdirSync(bin_dir)) {
            const ext = path.extname(entry).toLowerCase();
            if (!BUILD_ARTIFACT_BIN_EXTENSIONS.has(ext)) {
                continue;
            }

            const file_path = path.join(bin_dir, entry);
            if (!fs.statSync(file_path).isFile()) {
                continue;
            }

            const relative_path = path.relative(workspace_root, file_path);
            try {
                fs.unlinkSync(file_path);
                removed_count++;
                log_lines.push(t('[Delete] {0}', relative_path));
            } catch (error) {
                error_count++;
                const message = error instanceof Error ? error.message : String(error);
                log_lines.push(t('[Fail] {0}: {1}', relative_path, message));
            }
        }
    } else {
        log_lines.push(t('[Skip] win_b64\\code\\bin (not found)'));
    }

    for (const segments of BUILD_ARTIFACT_TARGET_FOLDERS) {
        const folder_path = path.join(workspace_root, ...segments);
        const relative_path = segments.join(path.sep);

        if (!fs.existsSync(folder_path)) {
            log_lines.push(t('[Skip] {0} (not found)', relative_path));
            continue;
        }

        try {
            fs.rmSync(folder_path, { recursive: true, force: true });
            removed_count++;
            log_lines.push(t('[Delete] {0}', `${relative_path}\\`));
        } catch (error) {
            error_count++;
            const message = error instanceof Error ? error.message : String(error);
            log_lines.push(t('[Fail] {0}: {1}', relative_path, message));
        }
    }

    return {
        success: error_count === 0,
        removed_count,
        error_count,
        log_lines,
    };
}

/**
 * 递归查找 win_b64 目录
 */
function find_win_b64_directories_(root_path: string, results: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(root_path, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const dir_path = path.join(root_path, entry.name);
        if (entry.name === WIN_B64_DIR_NAME) {
            results.push(dir_path);
        }

        find_win_b64_directories_(dir_path, results);
    }
}
