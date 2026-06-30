import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { t } from '../i18n/t';

/** 默认文件夹筛选规则（与 XYVBuildlinkTool 一致） */
export const DEFAULT_BUILDLINK_FILTER = '*.Frm,*.Interfaces,*.Tlb';

/** 默认禁用词，匹配到的文件夹将被排除（不收录、不递归） */
export const DEFAULT_BUILDLINK_BAN_WORDS = 'PNX*';

/** 递归扫描时跳过的目录名 */
const EXCLUDED_FOLDER_NAMES = new Set([
    'localinterfaces',
    'publicinterfaces',
    'importedinterfaces',
    'privateinterfaces',
    'toolsdata',
]);

/** mklink 权限不足时的典型输出关键字 */
const MKLINK_PRIVILEGE_HINTS = [
    'sufficient privilege',
    'privilege',
    '权限',
    'elevated',
    '管理员',
];

export function get_mklink_privilege_help(): string {
    return t(
        'mklink /D requires Administrator privileges, or enable Developer Mode under Windows Settings → Privacy & security → For developers. You can also run Cursor/VS Code as Administrator and retry.'
    );
}

export interface BuildlinkGenerateResult {
    success_count: number;
    fail_count: number;
    fail_messages: string[];
    /** 是否检测到权限不足（需管理员或开发者模式） */
    privilege_denied?: boolean;
}

interface MklinkRunResult {
    exit_code: number;
    output: string;
    privilege_denied: boolean;
}

/**
 * 检查文件夹名是否匹配筛选规则
 * @param folder_name 文件夹名
 * @param filter_text 逗号分隔的筛选规则
 */
export function matches_buildlink_filter(folder_name: string, filter_text: string): boolean {
    return matches_any_pattern_(folder_name, filter_text);
}

/**
 * 检查文件夹名是否命中禁用词
 * @param folder_name 文件夹名
 * @param ban_words_text 逗号分隔的禁用规则
 */
export function matches_buildlink_ban_words(folder_name: string, ban_words_text: string): boolean {
    return matches_any_pattern_(folder_name, ban_words_text);
}

/**
 * 递归查找符合条件的文件夹，返回带 .\ 前缀的相对路径列表
 * @param source_path 源根目录
 * @param filter_text 筛选规则
 * @param ban_words_text 禁用词规则
 */
export function fetch_buildlink_folders(
    source_path: string,
    filter_text: string,
    ban_words_text: string = DEFAULT_BUILDLINK_BAN_WORDS
): string[] {
    const normalized_source = ensure_trailing_separator_(path.resolve(source_path));
    const results: string[] = [];
    find_folders_(normalized_source, normalized_source, filter_text, ban_words_text, results);
    return results;
}

/**
 * 为列表中的相对路径创建目录软链接（mklink /D）
 * @param source_root 源根目录
 * @param target_root 目标根目录
 * @param relative_paths 相对路径列表（可含 .\ 前缀）
 */
export function generate_buildlink_symlinks(
    source_root: string,
    target_root: string,
    relative_paths: string[]
): BuildlinkGenerateResult {
    const result: BuildlinkGenerateResult = {
        success_count: 0,
        fail_count: 0,
        fail_messages: [],
    };

    if (relative_paths.length === 0) {
        return result;
    }

    const source_base = ensure_trailing_separator_(path.resolve(source_root));
    const target_base = ensure_trailing_separator_(path.resolve(target_root));

    if (!fs.existsSync(target_base)) {
        fs.mkdirSync(target_base, { recursive: true });
    }

    for (const item of relative_paths) {
        try {
            let relative_path = item;
            if (relative_path.startsWith('.\\') || relative_path.startsWith('./')) {
                relative_path = relative_path.substring(2);
            }

            const source_full_path = path.resolve(path.join(source_base, relative_path));
            if (!fs.existsSync(source_full_path) || !fs.statSync(source_full_path).isDirectory()) {
                result.fail_count++;
                result.fail_messages.push(t('Source path does not exist: {0}', relative_path));
                continue;
            }

            let folder_name = path.basename(relative_path);
            if (!folder_name) {
                folder_name = path.basename(source_full_path);
            }

            const target_link_path = format_mklink_path_(path.join(target_base, folder_name));
            const source_path = format_mklink_path_(source_full_path);
            remove_existing_link_(target_link_path);

            const mklink_result = run_mklink_(target_link_path, source_path);
            if (mklink_result.exit_code === 0) {
                result.success_count++;
            } else {
                result.fail_count++;
                if (mklink_result.privilege_denied) {
                    result.privilege_denied = true;
                }
                const detail = mklink_result.output.trim() || `exit ${mklink_result.exit_code}`;
                result.fail_messages.push(`${relative_path}: ${detail}`);
            }
        } catch (error) {
            result.fail_count++;
            const message = error instanceof Error ? error.message : String(error);
            result.fail_messages.push(`${item}: ${message}`);
        }
    }

    return result;
}

/**
 * 将相对路径转为完整源路径
 */
export function resolve_buildlink_full_path(source_root: string, relative_path: string): string {
    let normalized = relative_path;
    if (normalized.startsWith('.\\') || normalized.startsWith('./')) {
        normalized = normalized.substring(2);
    }
    return path.resolve(path.join(source_root, normalized));
}

/**
 * 检查名称是否匹配逗号分隔规则中的任一项
 */
function matches_any_pattern_(name: string, rules_text: string): boolean {
    const trimmed_rules = rules_text.trim();
    if (!trimmed_rules) {
        return false;
    }

    for (const pattern of trimmed_rules.split(',')) {
        if (matches_single_pattern_(name, pattern.trim())) {
            return true;
        }
    }

    return false;
}

/**
 * 检查名称是否匹配单条通配规则
 */
function matches_single_pattern_(name: string, pattern: string): boolean {
    if (!pattern) {
        return false;
    }

    if (pattern.startsWith('*')) {
        let suffix = pattern.substring(1);
        if (suffix.startsWith('.')) {
            suffix = suffix.substring(1);
        }
        return name.toLowerCase().endsWith(suffix.toLowerCase());
    }

    if (pattern.endsWith('*')) {
        let prefix = pattern.substring(0, pattern.length - 1);
        if (prefix.endsWith('.')) {
            prefix = prefix.substring(0, prefix.length - 1);
        }
        return name.toLowerCase().startsWith(prefix.toLowerCase());
    }

    if (pattern.includes('*')) {
        return wildcard_match_(name, pattern);
    }

    return name.toLowerCase() === pattern.toLowerCase();
}

/**
 * 简单通配符匹配（* 表示任意字符）
 */
function wildcard_match_(text: string, pattern: string): boolean {
    const regex = new RegExp(
        '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
        'i'
    );
    return regex.test(text);
}

/**
 * 递归查找文件夹
 */
function find_folders_(
    root_path: string,
    base_path: string,
    filter_text: string,
    ban_words_text: string,
    results: string[]
): void {
    let directories: string[];
    try {
        directories = fs.readdirSync(root_path, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => path.join(root_path, entry.name));
    } catch {
        return;
    }

    for (const dir of directories) {
        const folder_name = path.basename(dir);

        if (EXCLUDED_FOLDER_NAMES.has(folder_name.toLowerCase())) {
            continue;
        }

        if (matches_buildlink_ban_words(folder_name, ban_words_text)) {
            continue;
        }

        if (dir.toLowerCase().includes(`${path.sep}toolsdata${path.sep}`)) {
            continue;
        }

        if (matches_buildlink_filter(folder_name, filter_text)) {
            let relative_path = path.relative(base_path, dir);
            if (!relative_path.startsWith('.\\') && !relative_path.startsWith('./')) {
                relative_path = `.\\${relative_path}`;
            }
            results.push(relative_path);
        }

        find_folders_(dir, base_path, filter_text, ban_words_text, results);
    }
}

function ensure_trailing_separator_(dir_path: string): string {
    if (dir_path.endsWith(path.sep)) {
        return dir_path;
    }
    return dir_path + path.sep;
}

function remove_existing_link_(target_path: string): void {
    const normalized = format_mklink_path_(target_path);
    if (!fs.existsSync(normalized)) {
        return;
    }

    try {
        fs.rmSync(normalized, { recursive: true, force: true });
    } catch {
        try {
            execSync(`cmd /d /s /c "rmdir /s /q ${quote_cmd_path_(normalized)}"`, {
                windowsHide: true,
                encoding: 'buffer',
                shell: process.env.ComSpec,
            });
        } catch {
            // 忽略删除失败，由 mklink 报错
        }
    }
}

/**
 * 规范化 mklink 使用的绝对路径（反斜杠、去除末尾分隔符）
 */
function format_mklink_path_(dir_path: string): string {
    return path.win32.normalize(path.resolve(dir_path)).replace(/[\\/]+$/, '');
}

/**
 * 为 cmd 引号包裹路径（避免末尾 \\ 转义闭合引号）
 */
function quote_cmd_path_(dir_path: string): string {
    return `"${format_mklink_path_(dir_path).replace(/"/g, '""')}"`;
}

function run_mklink_(target_link_path: string, source_full_path: string): MklinkRunResult {
    const target = quote_cmd_path_(target_link_path);
    const source = quote_cmd_path_(source_full_path);
    const command = `mklink /D ${target} ${source}`;

    try {
        const stdout = execSync(command, {
            windowsHide: true,
            encoding: 'buffer',
            shell: process.env.ComSpec,
        });
        const output = decode_windows_cmd_output_(stdout);
        return {
            exit_code: 0,
            output,
            privilege_denied: false,
        };
    } catch (error) {
        const exec_error = error as NodeJS.ErrnoException & {
            stdout?: Buffer;
            stderr?: Buffer;
            status?: number | null;
        };
        const output =
            decode_windows_cmd_output_(exec_error.stderr) ||
            decode_windows_cmd_output_(exec_error.stdout) ||
            exec_error.message ||
            t('mklink failed');

        return {
            exit_code: typeof exec_error.status === 'number' ? exec_error.status : 1,
            output,
            privilege_denied: is_mklink_privilege_error_(output),
        };
    }
}

function decode_windows_cmd_output_(buffer?: Buffer | string): string {
    if (!buffer) {
        return '';
    }
    if (typeof buffer === 'string') {
        return buffer.trim();
    }
    try {
        return new TextDecoder('gb18030').decode(buffer).trim();
    } catch {
        return buffer.toString('utf8').trim();
    }
}

function is_mklink_privilege_error_(text: string): boolean {
    const lower = text.toLowerCase();
    return MKLINK_PRIVILEGE_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
}
