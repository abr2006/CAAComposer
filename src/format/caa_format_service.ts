import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { get_caa_config, get_workspace_root } from '../config/caa_config';
import { t } from '../i18n/t';

const VSCODE_DIR = '.vscode';
const SETTINGS_JSON = 'settings.json';
const EXTENSIONS_JSON = 'extensions.json';
const CLANG_FORMAT_FILE = '.clang-format';
const CPP_PROPERTIES_JSON = 'c_cpp_properties.json';
const CPP_TOOLS_EXTENSION_ID = 'ms-vscode.cpptools';
/** 格式化时跳过的目录（与 Catalog 扫描一致，排除构建产物目录） */
const FORMAT_SKIP_DIR_NAMES = ['win_b64', 'intel_a', 'out', 'dist', 'node_modules', '.git'] as const;

const FORMAT_SKIP_DIR_SET = new Set<string>(FORMAT_SKIP_DIR_NAMES);

const FORMAT_EXCLUDE_GLOB = `{${FORMAT_SKIP_DIR_NAMES.map((name) => `**/${name}/**`).join(',')}}`;

export interface FormatAllCppResult {
    formatted_count: number;
    failed_count: number;
    skipped_count: number;
    log_lines: string[];
}

export interface FormatAllCppOptions {
    on_log_line?: (line: string) => void;
    /** 工作区根下待格式化的子文件夹（相对路径） */
    target_dirs?: string[];
}

export interface ClangFormatSetupResult {
    clang_format_created: boolean;
    settings_updated: boolean;
    cpp_properties_created: boolean;
}

/**
 * 写入 .clang-format 并配置工作区自动格式化
 */
export async function setup_clang_format(
    workspace_root: string,
    extension_path: string
): Promise<ClangFormatSetupResult> {
    const config = get_caa_config();
    const result: ClangFormatSetupResult = {
        clang_format_created: false,
        settings_updated: false,
        cpp_properties_created: false,
    };

    result.clang_format_created = copy_clang_format_template_(workspace_root, extension_path);
    result.cpp_properties_created = copy_cpp_properties_template_(workspace_root, extension_path);

    if (config.format.format_on_save) {
        result.settings_updated = await merge_workspace_format_settings_(workspace_root, config);
    }

    await ensure_cpp_tools_recommendation_(path.join(workspace_root, VSCODE_DIR));
    return result;
}

/**
 * 缺少 .clang-format 或格式化相关配置时写入
 */
export async function ensure_clang_format_if_missing(extension_path: string): Promise<void> {
    const workspace_root = get_workspace_root();
    if (!workspace_root) {
        return;
    }

    const config = get_caa_config();
    if (!config.format.auto_setup_clang_format) {
        return;
    }

    const clang_format_path = path.join(workspace_root, CLANG_FORMAT_FILE);
    const cpp_properties_path = path.join(workspace_root, VSCODE_DIR, CPP_PROPERTIES_JSON);
    const settings_path = path.join(workspace_root, VSCODE_DIR, SETTINGS_JSON);
    const has_clang_format = fs.existsSync(clang_format_path);
    const has_cpp_properties = fs.existsSync(cpp_properties_path);
    const has_format_settings = has_format_settings_(settings_path);

    if (has_clang_format && has_cpp_properties && has_format_settings) {
        return;
    }

    await setup_clang_format(workspace_root, extension_path);
}

/**
 * 列出工作区根目录下可用于格式化的子文件夹（含 Windows 目录联接 / 符号链接）
 */
export function list_workspace_format_subfolders(workspace_root: string): string[] {
    if (!fs.existsSync(workspace_root)) {
        return [];
    }

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(workspace_root, { withFileTypes: true });
    } catch {
        return [];
    }

    return entries
        .filter((entry) => is_format_subfolder_entry_(workspace_root, entry))
        .map((entry) => entry.name)
        .filter((name) => !name.startsWith('.'))
        .filter((name) => !FORMAT_SKIP_DIR_SET.has(name.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));
}

/**
 * 递归 clang-format 工作区内所选子文件夹中的 .cpp / .h 文件
 */
export async function format_all_cpp_sources(
    workspace_root: string,
    extension_path: string,
    options?: FormatAllCppOptions
): Promise<FormatAllCppResult> {
    const result: FormatAllCppResult = {
        formatted_count: 0,
        failed_count: 0,
        skipped_count: 0,
        log_lines: [],
    };

    const append_log = (line: string): void => {
        result.log_lines.push(line);
        options?.on_log_line?.(line);
    };

    await setup_clang_format(workspace_root, extension_path);

    const relative_dirs = (options?.target_dirs ?? [])
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    if (relative_dirs.length === 0) {
        append_log(t('Select at least one subfolder to format.'));
        void vscode.window.showWarningMessage(t('Select at least one subfolder to format.'));
        return result;
    }

    const scope_dirs = resolve_format_scope_dirs_(workspace_root, relative_dirs);
    if (!scope_dirs) {
        append_log(t('Selected folder must be inside the workspace.'));
        void vscode.window.showErrorMessage(t('Selected folder must be inside the workspace.'));
        return result;
    }

    append_log(t('[CAA Composer] Workspace: {0}', workspace_root));
    append_log(t('[CAA Composer] Action: Format C++/H in selected subfolders'));
    for (const relative_dir of relative_dirs) {
        append_log(t('[CAA Composer] Folder: {0}', relative_dir));
    }
    append_log('---');

    if (!is_clang_format_available_()) {
        append_log(t('clang-format was not found in PATH. Install LLVM clang-format and retry.'));
        void vscode.window.showErrorMessage(
            t('clang-format was not found in PATH. Install LLVM clang-format and retry.')
        );
        return result;
    }

    const file_paths = await collect_cpp_header_files_(workspace_root, scope_dirs);
    if (file_paths.length === 0) {
        append_log(t('No .cpp or .h files found in the selected subfolders.'));
        void vscode.window.showInformationMessage(t('No .cpp or .h files found in the selected subfolders.'));
        return result;
    }

    append_log(t('Found {0} file(s) to format.', file_paths.length));

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: t('Formatting C++ sources…'),
            cancellable: true,
        },
        async (progress, token) => {
            for (let index = 0; index < file_paths.length; index++) {
                if (token.isCancellationRequested) {
                    result.skipped_count = file_paths.length - index;
                    append_log(t('Format cancelled.'));
                    break;
                }

                const file_path = file_paths[index];
                const relative_path = to_relative_path_(workspace_root, file_path);
                progress.report({
                    message: path.basename(file_path),
                    increment: 100 / file_paths.length,
                });

                if (run_clang_format_on_file_(file_path)) {
                    result.formatted_count++;
                    append_log(`[OK] ${relative_path}`);
                } else {
                    result.failed_count++;
                    append_log(`[FAIL] ${relative_path}`);
                }
            }
        }
    );

    append_log('---');
    append_log(
        t(
            'Done: formatted {0} file(s), {1} failed, {2} skipped.',
            result.formatted_count,
            result.failed_count,
            result.skipped_count
        )
    );

    if (result.formatted_count > 0 && result.failed_count === 0 && result.skipped_count === 0) {
        void vscode.window.showInformationMessage(
            t('Formatted {0} C++ file(s).', result.formatted_count)
        );
    } else if (result.formatted_count > 0) {
        void vscode.window.showWarningMessage(
            t(
                'Formatted {0} file(s), {1} failed, {2} skipped.',
                result.formatted_count,
                result.failed_count,
                result.skipped_count
            )
        );
    } else if (result.failed_count > 0) {
        void vscode.window.showErrorMessage(
            t('Failed to format {0} file(s).', result.failed_count)
        );
    }

    return result;
}

function copy_clang_format_template_(workspace_root: string, extension_path: string): boolean {
    const target_path = path.join(workspace_root, CLANG_FORMAT_FILE);
    if (fs.existsSync(target_path)) {
        return false;
    }

    const template_path = path.join(extension_path, 'resources', 'clang-format');
    if (!fs.existsSync(template_path)) {
        void vscode.window.showErrorMessage(t('Bundled clang-format template is missing.'));
        return false;
    }

    fs.copyFileSync(template_path, target_path);
    return true;
}

function copy_cpp_properties_template_(workspace_root: string, extension_path: string): boolean {
    const vscode_dir = path.join(workspace_root, VSCODE_DIR);
    const target_path = path.join(vscode_dir, CPP_PROPERTIES_JSON);
    if (fs.existsSync(target_path)) {
        return false;
    }

    const template_path = path.join(extension_path, 'resources', CPP_PROPERTIES_JSON);
    if (!fs.existsSync(template_path)) {
        void vscode.window.showErrorMessage(t('Bundled c_cpp_properties.json template is missing.'));
        return false;
    }

    if (!fs.existsSync(vscode_dir)) {
        fs.mkdirSync(vscode_dir, { recursive: true });
    }

    fs.copyFileSync(template_path, target_path);
    return true;
}

async function merge_workspace_format_settings_(
    workspace_root: string,
    config: ReturnType<typeof get_caa_config>
): Promise<boolean> {
    const vscode_dir = path.join(workspace_root, VSCODE_DIR);
    const settings_path = path.join(vscode_dir, SETTINGS_JSON);

    if (!fs.existsSync(vscode_dir)) {
        fs.mkdirSync(vscode_dir, { recursive: true });
    }

    const merged = parse_json_file_(settings_path) ?? {};
    const format_settings = build_format_settings_(config);
    deep_merge_(merged, format_settings);

    const body = JSON.stringify(merged, null, 4) + '\r\n';
    if (fs.existsSync(settings_path) && fs.readFileSync(settings_path, 'utf8') === body) {
        return false;
    }

    fs.writeFileSync(settings_path, body, 'utf8');
    return true;
}

function build_format_settings_(config: ReturnType<typeof get_caa_config>): Record<string, unknown> {
    return {
        'C_Cpp.formatting': 'clangFormat',
        'C_Cpp.clang_format_style': 'file',
        'editor.formatOnSave': config.format.format_on_save,
        '[cpp]': {
            'editor.defaultFormatter': CPP_TOOLS_EXTENSION_ID,
        },
        '[c]': {
            'editor.defaultFormatter': CPP_TOOLS_EXTENSION_ID,
        },
    };
}

function has_format_settings_(settings_path: string): boolean {
    const parsed = parse_json_file_(settings_path);
    if (!parsed) {
        return false;
    }

    return (
        parsed['C_Cpp.clang_format_style'] === 'file' &&
        parsed['C_Cpp.formatting'] === 'clangFormat'
    );
}

async function ensure_cpp_tools_recommendation_(vscode_dir: string): Promise<void> {
    const extensions_path = path.join(vscode_dir, EXTENSIONS_JSON);
    let recommendations: string[] = [];

    if (fs.existsSync(extensions_path)) {
        const parsed = parse_json_file_(extensions_path);
        if (parsed && Array.isArray(parsed.recommendations)) {
            recommendations = parsed.recommendations as string[];
        }
    }

    if (recommendations.includes(CPP_TOOLS_EXTENSION_ID)) {
        return;
    }

    recommendations.push(CPP_TOOLS_EXTENSION_ID);
    const body =
        JSON.stringify(
            {
                recommendations,
            },
            null,
            4
        ) + '\r\n';
    fs.writeFileSync(extensions_path, body, 'utf8');
}

function parse_json_file_(file_path: string): Record<string, unknown> | undefined {
    if (!fs.existsSync(file_path)) {
        return undefined;
    }

    try {
        const text = fs.readFileSync(file_path, 'utf8');
        const sanitized = text.replace(/\/\/.*$/gm, '').replace(/,\s*([\]}])/g, '$1');
        const parsed = JSON.parse(sanitized) as Record<string, unknown>;
        return parsed && typeof parsed === 'object' ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function deep_merge_(target: Record<string, unknown>, source: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(source)) {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            target[key] &&
            typeof target[key] === 'object' &&
            !Array.isArray(target[key])
        ) {
            deep_merge_(target[key] as Record<string, unknown>, value as Record<string, unknown>);
        } else {
            target[key] = value;
        }
    }
}

async function collect_cpp_header_files_(workspace_root: string, scope_dirs: string[]): Promise<string[]> {
    const paths = new Set<string>();

    for (const scope_dir of scope_dirs) {
        const files = await collect_cpp_header_files_in_scope_(workspace_root, scope_dir);
        for (const file_path of files) {
            paths.add(file_path);
        }
    }

    return [...paths].sort((a, b) => a.localeCompare(b));
}

async function collect_cpp_header_files_in_scope_(workspace_root: string, scope_dir: string): Promise<string[]> {
    const relative_scope = path.relative(workspace_root, scope_dir);
    const posix_scope = relative_scope.split(path.sep).join('/');
    const prefix = !posix_scope || posix_scope === '.' ? '' : `${posix_scope}/`;

    const cpp_files = await vscode.workspace.findFiles(`${prefix}**/*.cpp`, FORMAT_EXCLUDE_GLOB);
    const header_files = await vscode.workspace.findFiles(`${prefix}**/*.h`, FORMAT_EXCLUDE_GLOB);
    const paths = new Set<string>();

    for (const uri of [...cpp_files, ...header_files]) {
        if (!is_under_skipped_dir_(uri.fsPath) && is_under_dir_(uri.fsPath, scope_dir)) {
            paths.add(uri.fsPath);
        }
    }

    // findFiles 可能不跟随 Windows 目录联接；为空时回退为文件系统遍历
    if (paths.size === 0) {
        for (const file_path of walk_cpp_header_files_(scope_dir)) {
            if (!is_under_skipped_dir_(file_path)) {
                paths.add(file_path);
            }
        }
    }

    return [...paths].sort((a, b) => a.localeCompare(b));
}

/**
 * 是否为可展示的格式化子目录（普通目录，或指向目录的联接/符号链接）
 * Windows 上 mklink /J 的 Dirent.isDirectory() 为 false，必须用 stat 跟随判断
 */
function is_format_subfolder_entry_(workspace_root: string, entry: fs.Dirent): boolean {
    if (entry.isDirectory()) {
        return true;
    }

    const full_path = path.join(workspace_root, entry.name);
    let is_link = false;
    try {
        is_link = entry.isSymbolicLink();
    } catch {
        is_link = false;
    }
    if (!is_link) {
        try {
            is_link = fs.lstatSync(full_path).isSymbolicLink();
        } catch {
            return false;
        }
    }
    if (!is_link) {
        return false;
    }

    try {
        return fs.statSync(full_path).isDirectory();
    } catch {
        return false;
    }
}

/**
 * 在目录树内收集 .cpp / .h（跟随目录联接；跳过 FORMAT_SKIP_DIR_SET）
 */
function walk_cpp_header_files_(root_dir: string): string[] {
    const results: string[] = [];
    const queue = [root_dir];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            break;
        }

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            const name_lower = entry.name.toLowerCase();
            if (name_lower.startsWith('.') || FORMAT_SKIP_DIR_SET.has(name_lower)) {
                continue;
            }

            const full_path = path.join(current, entry.name);
            let is_dir = entry.isDirectory();
            let is_file = entry.isFile();
            if (!is_dir && !is_file) {
                try {
                    const st = fs.statSync(full_path);
                    is_dir = st.isDirectory();
                    is_file = st.isFile();
                } catch {
                    continue;
                }
            }

            if (is_dir) {
                queue.push(full_path);
                continue;
            }
            if (!is_file) {
                continue;
            }
            if (name_lower.endsWith('.cpp') || name_lower.endsWith('.h')) {
                results.push(full_path);
            }
        }
    }

    return results;
}

function resolve_format_scope_dirs_(workspace_root: string, relative_dirs: string[]): string[] | undefined {
    const resolved: string[] = [];

    for (const relative_dir of relative_dirs) {
        const scope_dir = resolve_format_scope_dir_(workspace_root, path.join(workspace_root, relative_dir));
        if (!scope_dir) {
            return undefined;
        }
        resolved.push(scope_dir);
    }

    return resolved;
}

function resolve_format_scope_dir_(workspace_root: string, target_dir?: string): string | undefined {
    const candidate = target_dir?.trim() || workspace_root;
    if (!fs.existsSync(candidate)) {
        return undefined;
    }

    const stat = fs.statSync(candidate);
    if (!stat.isDirectory()) {
        return undefined;
    }

    const normalized_workspace = path.normalize(workspace_root);
    const normalized_candidate = path.normalize(candidate);
    if (!is_under_dir_(normalized_candidate, normalized_workspace) && normalized_candidate !== normalized_workspace) {
        return undefined;
    }

    return normalized_candidate;
}

function is_under_dir_(file_path: string, dir_path: string): boolean {
    const relative = path.relative(path.normalize(dir_path), path.normalize(file_path));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function is_under_skipped_dir_(file_path: string): boolean {
    const segments = file_path.split(/[\\/]/);
    return segments.some((segment) => FORMAT_SKIP_DIR_SET.has(segment.toLowerCase()));
}

function is_clang_format_available_(): boolean {
    try {
        execFileSync('clang-format', ['--version'], { windowsHide: true });
        return true;
    } catch {
        return false;
    }
}

function to_relative_path_(workspace_root: string, file_path: string): string {
    const relative = path.relative(workspace_root, file_path);
    return relative.split(path.sep).join('/');
}

function run_clang_format_on_file_(file_path: string): boolean {
    try {
        execFileSync('clang-format', ['-i', '-style=file', file_path], {
            windowsHide: true,
        });
        return true;
    } catch {
        return false;
    }
}
