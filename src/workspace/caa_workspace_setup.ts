import * as fs from 'fs';
import * as path from 'path';
import { CNEXT_LAUNCH_CONFIG_NAME } from '../debug/caa_debug_service';

const VSCODE_DIR = '.vscode';
const LAUNCH_JSON = 'launch.json';
const CPP_PROPERTIES_JSON = 'c_cpp_properties.json';

/**
 * 判断工作区是否已通过 Build 生成 CAA 所需的 .vscode 配置
 */
export function is_caa_workspace_initialized(workspace_root: string): boolean {
    const vscode_dir = path.join(workspace_root, VSCODE_DIR);
    if (!fs.existsSync(vscode_dir)) {
        return false;
    }

    return (
        has_cnext_launch_json_(workspace_root) &&
        fs.existsSync(path.join(vscode_dir, CPP_PROPERTIES_JSON))
    );
}

function has_cnext_launch_json_(workspace_root: string): boolean {
    const launch_path = path.join(workspace_root, VSCODE_DIR, LAUNCH_JSON);
    if (!fs.existsSync(launch_path)) {
        return false;
    }

    try {
        const text = fs.readFileSync(launch_path, 'utf8');
        const sanitized = text.replace(/\/\/.*$/gm, '').replace(/,\s*([\]}])/g, '$1');
        const parsed = JSON.parse(sanitized) as { configurations?: Array<{ name?: string }> };
        return (parsed.configurations ?? []).some((item) => item.name === CNEXT_LAUNCH_CONFIG_NAME);
    } catch {
        return false;
    }
}
