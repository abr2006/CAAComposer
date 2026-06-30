import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { get_caa_config, get_workspace_root } from '../config/caa_config';
import { t } from '../i18n/t';

export const CNEXT_LAUNCH_CONFIG_NAME = 'Attach to CATIA CNEXT';
const VSCODE_DIR = '.vscode';
const LAUNCH_JSON = 'launch.json';
const EXTENSIONS_JSON = 'extensions.json';
const CPP_TOOLS_EXTENSION_ID = 'ms-vscode.cpptools';

interface LaunchFile {
    version: string;
    configurations: Array<Record<string, unknown>>;
}

/**
 * 生成 CNEXT 附加调试 launch 配置
 */
export function build_cnext_launch_configuration(): Record<string, unknown> {
    return {
        name: CNEXT_LAUNCH_CONFIG_NAME,
        type: 'cppvsdbg',
        request: 'attach',
        processId: '${command:caa-composer.pickCnextProcess}',
        symbolSearchPath: '${workspaceFolder}\\win_b64\\code\\bin',
    };
}

/**
 * 确保工作区 .vscode/launch.json 含 CNEXT 附加调试配置
 */
export async function ensure_launch_json(workspace_root: string): Promise<boolean> {
    const vscode_dir = path.join(workspace_root, VSCODE_DIR);
    const launch_path = path.join(vscode_dir, LAUNCH_JSON);

    if (!fs.existsSync(vscode_dir)) {
        fs.mkdirSync(vscode_dir, { recursive: true });
    }

    const target = build_cnext_launch_configuration();
    let launch_file: LaunchFile;

    if (fs.existsSync(launch_path)) {
        const parsed = parse_launch_json_(launch_path);
        if (!parsed) {
            vscode.window.showWarningMessage(
                t('Could not parse {0}; skipped updating launch.json.', launch_path)
            );
            return false;
        }

        launch_file = parsed;
        const index = launch_file.configurations.findIndex(
            (item) => item.name === CNEXT_LAUNCH_CONFIG_NAME
        );

        if (index >= 0) {
            launch_file.configurations[index] = {
                ...launch_file.configurations[index],
                ...target,
            };
        } else {
            launch_file.configurations.push(target);
        }
    } else {
        launch_file = {
            version: '0.2.0',
            configurations: [target],
        };
    }

    const body = JSON.stringify(launch_file, null, 4) + '\r\n';
    if (fs.existsSync(launch_path) && fs.readFileSync(launch_path, 'utf8') === body) {
        return false;
    }

    fs.writeFileSync(launch_path, body, 'utf8');
    await ensure_cpp_tools_recommendation_(vscode_dir);
    return true;
}

/**
 * 查找 CNEXT 进程 PID 列表
 */
export function find_cnext_process_ids(process_name: string): number[] {
    const normalized = process_name.trim();
    if (!normalized) {
        return [];
    }

    try {
        const output = execFileSync(
            'tasklist',
            ['/FI', `IMAGENAME eq ${normalized}`, '/FO', 'CSV', '/NH'],
            { encoding: 'utf8', windowsHide: true }
        );

        const pids: number[] = [];
        for (const line of output.split(/\r?\n/)) {
            if (!line.trim() || line.includes('No tasks are running')) {
                continue;
            }

            const columns = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!columns || columns.length < 2) {
                continue;
            }

            const pid = Number.parseInt(columns[1].replace(/"/g, ''), 10);
            if (!Number.isNaN(pid)) {
                pids.push(pid);
            }
        }

        return pids;
    } catch {
        return [];
    }
}

/**
 * 解析 CNEXT 进程 PID；多个实例时让用户选择
 */
export async function pick_cnext_process_id(): Promise<number | undefined> {
    const config = get_caa_config();
    let pids = find_cnext_process_ids(config.debug.process_name);

    if (pids.length === 0) {
        const alternate =
            config.debug.process_name.toLowerCase() === 'cnext.exe'
                ? 'CNEXT.exe'
                : 'cnext.exe';
        pids = find_cnext_process_ids(alternate);
    }

    if (pids.length === 0) {
        void vscode.window.showWarningMessage(
            t('{0} is not running. Start a test run first.', config.debug.process_name)
        );
        return undefined;
    }

    if (pids.length === 1) {
        return pids[0];
    }

    const picked = await vscode.window.showQuickPick(
        pids.map((pid) => ({
            label: `${config.debug.process_name} (${pid})`,
            pid,
        })),
        { placeHolder: t('Multiple {0} processes found. Select one to attach.', config.debug.process_name) }
    );

    return picked?.pid;
}

/**
 * 等待 CNEXT 启动并附加调试器
 */
export async function attach_to_cnext(workspace_root: string): Promise<boolean> {
    if (!ensure_cpp_tools_installed_()) {
        return false;
    }

    const config = get_caa_config();
    const timeout_ms = config.debug.attach_timeout_seconds * 1000;
    const started_at = Date.now();
    let pid: number | undefined;

    while (Date.now() - started_at < timeout_ms) {
        const pids = find_cnext_process_ids(config.debug.process_name);
        if (pids.length > 0) {
            pid = pids[pids.length - 1];
            break;
        }
        await delay_(500);
    }

    if (!pid) {
        void vscode.window.showWarningMessage(
            t('Timed out waiting for {0} ({1}s).', config.debug.process_name, config.debug.attach_timeout_seconds)
        );
        return false;
    }

    const folder = vscode.workspace.workspaceFolders?.find(
        (item) => path.normalize(item.uri.fsPath) === path.normalize(workspace_root)
    );
    if (!folder) {
        void vscode.window.showErrorMessage(t('Open a CAA workspace folder first.'));
        return false;
    }

    const symbol_dir = path.join(workspace_root, 'win_b64', 'code', 'bin');
    const debug_config: vscode.DebugConfiguration = {
        name: CNEXT_LAUNCH_CONFIG_NAME,
        type: 'cppvsdbg',
        request: 'attach',
        processId: pid,
        symbolSearchPath: symbol_dir,
    };

    const started = await vscode.debug.startDebugging(folder, debug_config);
    if (started) {
        void vscode.window.showInformationMessage(
            t('Attached to {0} (PID {1}).', config.debug.process_name, pid)
        );
    } else {
        void vscode.window.showErrorMessage(t('Failed to start debugger attach session.'));
    }

    return started;
}

/**
 * 测试运行后：写入 launch.json 并等待 CNEXT 后附加
 */
export async function prepare_and_attach_after_test_run(workspace_root: string): Promise<void> {
    const config = get_caa_config();

    if (config.debug.auto_setup_launch_json) {
        await ensure_launch_json(workspace_root);
    }

    if (!config.debug.auto_attach_on_test_run) {
        return;
    }

    void vscode.window.setStatusBarMessage(
        t('Waiting for {0} to attach debugger…', config.debug.process_name),
        config.debug.attach_timeout_seconds * 1000
    );

    await attach_to_cnext(workspace_root);
}

/**
 * 工作区打开时自动写入 launch.json
 */
export async function auto_setup_launch_json_on_activate(): Promise<void> {
    const workspace_root = get_workspace_root();
    if (!workspace_root) {
        return;
    }

    const config = get_caa_config();
    if (!config.debug.auto_setup_launch_json) {
        return;
    }

    const launch_path = path.join(workspace_root, VSCODE_DIR, LAUNCH_JSON);
    if (fs.existsSync(launch_path)) {
        const parsed = parse_launch_json_(launch_path);
        if (parsed?.configurations.some((item) => item.name === CNEXT_LAUNCH_CONFIG_NAME)) {
            return;
        }
    }

    await ensure_launch_json(workspace_root);
}

function ensure_cpp_tools_installed_(): boolean {
    const extension = vscode.extensions.getExtension(CPP_TOOLS_EXTENSION_ID);
    if (extension) {
        return true;
    }

    void vscode.window.showWarningMessage(
        t('Install the C/C++ extension (ms-vscode.cpptools) to debug CNEXT.')
    );
    return false;
}

async function ensure_cpp_tools_recommendation_(vscode_dir: string): Promise<void> {
    const extensions_path = path.join(vscode_dir, EXTENSIONS_JSON);
    let recommendations: string[] = [];

    if (fs.existsSync(extensions_path)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(extensions_path, 'utf8')) as {
                recommendations?: string[];
            };
            recommendations = parsed.recommendations ?? [];
        } catch {
            recommendations = [];
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

function parse_launch_json_(launch_path: string): LaunchFile | undefined {
    try {
        const text = fs.readFileSync(launch_path, 'utf8');
        const sanitized = text.replace(/\/\/.*$/gm, '').replace(/,\s*([\]}])/g, '$1');
        const parsed = JSON.parse(sanitized) as LaunchFile;
        if (!Array.isArray(parsed.configurations)) {
            parsed.configurations = [];
        }
        parsed.version = parsed.version ?? '0.2.0';
        return parsed;
    } catch {
        return undefined;
    }
}

function delay_(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
