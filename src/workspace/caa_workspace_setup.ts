import * as fs from 'fs';
import * as path from 'path';

const VSCODE_DIR = '.vscode';
const LAUNCH_JSON = 'launch.json';
const CPP_PROPERTIES_JSON = 'c_cpp_properties.json';

/**
 * 判断工作区是否已具备 CAA 所需的 .vscode 配置文件
 */
export function is_caa_workspace_initialized(workspace_root: string): boolean {
    const vscode_dir = path.join(workspace_root, VSCODE_DIR);
    if (!fs.existsSync(vscode_dir)) {
        return false;
    }

    return (
        fs.existsSync(path.join(vscode_dir, LAUNCH_JSON)) &&
        fs.existsSync(path.join(vscode_dir, CPP_PROPERTIES_JSON))
    );
}
