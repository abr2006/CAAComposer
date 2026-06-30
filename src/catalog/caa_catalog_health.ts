import * as fs from 'fs';
import * as path from 'path';
import {
    CaaCatalogNamingConfig,
    resolve_catfct_file_name,
    resolve_catspecs_file_name,
} from '../config/caa_catalog_naming';

/** CATfct 二进制中应包含的字段名 */
const CATFCT_FEATURE_MARKER = 'FeatureBackUpGeoElem3D';

/**
 * Catalog 图形资源健康检查结果
 */
export interface CaaCatalogHealth {
    /** 缺少 CATfct 文件 */
    missing_catfct: boolean;
    /** 缺少 CATSpecs 文件 */
    missing_catspecs: boolean;
    /** 所有可用 CATfct 中均缺少 FeatureBackUpGeoElem3D */
    need_repair: boolean;
    /** 实际检测到的 CATfct 路径（用于 tooltip） */
    checked_catfct_paths: string[];
}

/**
 * 是否存在缺失的资源文件
 * @param health 健康检查结果
 */
export function is_catalog_missing(health: CaaCatalogHealth): boolean {
    return health.missing_catfct || health.missing_catspecs;
}

/**
 * 检测 graphic 目录下的 CATfct / CATSpecs（CNext 与 win_b64 均参与）
 * @param frm_path *Frm 目录绝对路径
 * @param module_name 模块名
 * @param workspace_root 工作区根目录
 * @param naming Catalog 命名规则
 */
export function check_catalog_health(
    frm_path: string,
    module_name: string,
    workspace_root: string,
    naming: CaaCatalogNamingConfig
): CaaCatalogHealth {
    const graphic_dirs = resolve_graphic_dirs_(frm_path, workspace_root);
    const expected_catfct = resolve_catfct_file_name(module_name, naming).toLowerCase();
    const expected_catspecs = resolve_catspecs_file_name(module_name, naming).toLowerCase();

    const catfct_paths = find_primary_resource_paths_(graphic_dirs, expected_catfct);
    const catspecs_paths = find_primary_resource_paths_(graphic_dirs, expected_catspecs);

    const missing_catfct = catfct_paths.length === 0;
    const missing_catspecs = catspecs_paths.length === 0;

    let need_repair = false;
    if (!missing_catfct) {
        need_repair = !catfct_paths.some((file_path) => catfct_contains_feature_marker_(file_path));
    }

    return {
        missing_catfct,
        missing_catspecs,
        need_repair,
        checked_catfct_paths: catfct_paths,
    };
}

/**
 * 解析可检测的 graphic 目录（源码 CNext + 编译输出 win_b64）
 */
function resolve_graphic_dirs_(frm_path: string, workspace_root: string): string[] {
    const candidates = [
        path.join(frm_path, 'CNext', 'resources', 'graphic'),
        path.join(workspace_root, 'win_b64', 'resources', 'graphic'),
    ];

    return candidates.filter((dir) => fs.existsSync(dir));
}

/**
 * 查找模块主资源文件（大小写不敏感）
 */
function find_primary_resource_paths_(
    graphic_dirs: string[],
    expected_file_name: string
): string[] {
    const found_paths: string[] = [];
    const seen_paths = new Set<string>();

    for (const graphic_dir of graphic_dirs) {
        let file_names: string[];
        try {
            file_names = fs.readdirSync(graphic_dir);
        } catch {
            continue;
        }

        for (const file_name of file_names) {
            if (file_name.toLowerCase() !== expected_file_name) {
                continue;
            }

            const file_path = path.join(graphic_dir, file_name);
            let stat: fs.Stats;
            try {
                stat = fs.statSync(file_path);
            } catch {
                continue;
            }
            if (!stat.isFile()) {
                continue;
            }

            const normalized = file_path.toLowerCase();
            if (seen_paths.has(normalized)) {
                continue;
            }

            seen_paths.add(normalized);
            found_paths.push(file_path);
        }
    }

    return found_paths;
}

/**
 * 检测 CATfct 二进制是否包含 FeatureBackUpGeoElem3D（ASCII / UTF-16LE）
 */
function catfct_contains_feature_marker_(file_path: string): boolean {
    let content: Buffer;
    try {
        content = fs.readFileSync(file_path);
    } catch {
        return false;
    }

    const ascii_marker = Buffer.from(CATFCT_FEATURE_MARKER, 'ascii');
    if (content.includes(ascii_marker)) {
        return true;
    }

    const utf16_marker = Buffer.from(CATFCT_FEATURE_MARKER, 'utf16le');
    return content.includes(utf16_marker);
}
