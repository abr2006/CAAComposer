import * as fs from 'fs';
import * as path from 'path';
import {
    CaaCatalogNamingConfig,
    is_matching_frm_dir,
    parse_module_name_from_catalog_dir,
} from '../config/caa_catalog_naming';

/** 递归扫描时跳过的目录名 */
const SKIP_DIR_NAMES = new Set([
    '.git',
    'node_modules',
    'win_b64',
    'intel_a',
    'out',
    'dist',
]);

/**
 * 工作区内扫描到的 CAA Catalog 模块
 */
export interface CaaCatalogEntry {
    /** 模块名，如 XYCMyModule */
    module_name: string;
    /** *Frm 目录绝对路径 */
    frm_path: string;
    /** *Catalog.m 目录绝对路径 */
    catalog_path: string;
}

/**
 * 递归扫描工作区，查找 Catalog 目录及其上一层 Frm 目录
 * @param workspace_root 工作区根目录
 * @param naming Catalog 命名规则
 */
export function scan_caa_catalogs(
    workspace_root: string,
    naming: CaaCatalogNamingConfig
): CaaCatalogEntry[] {
    const entries: CaaCatalogEntry[] = [];
    const seen_modules = new Set<string>();

    scan_directory_(workspace_root, naming, entries, seen_modules);
    entries.sort((a, b) => a.module_name.localeCompare(b.module_name));
    return entries;
}

/**
 * 深度优先扫描目录
 */
function scan_directory_(
    current_dir: string,
    naming: CaaCatalogNamingConfig,
    entries: CaaCatalogEntry[],
    seen_modules: Set<string>
): void {
    let dir_names: string[];
    try {
        dir_names = fs.readdirSync(current_dir);
    } catch {
        return;
    }

    for (const dir_name of dir_names) {
        if (SKIP_DIR_NAMES.has(dir_name)) {
            continue;
        }

        const full_path = path.join(current_dir, dir_name);
        let stat: fs.Stats;
        try {
            stat = fs.statSync(full_path);
        } catch {
            continue;
        }
        if (!stat.isDirectory()) {
            continue;
        }

        const module_name = parse_module_name_from_catalog_dir(dir_name, naming);
        if (module_name) {
            const frm_path = path.dirname(full_path);
            const frm_dir_name = path.basename(frm_path);
            if (
                is_matching_frm_dir(frm_dir_name, module_name, naming) &&
                !seen_modules.has(module_name)
            ) {
                seen_modules.add(module_name);
                entries.push({
                    module_name,
                    frm_path,
                    catalog_path: full_path,
                });
            }
        }

        scan_directory_(full_path, naming, entries, seen_modules);
    }
}
