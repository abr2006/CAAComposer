import * as vscode from 'vscode';

/** Catalog 命名默认值（兼容原 XYC 约定） */
export const DEFAULT_CATALOG_MODULE_PREFIX = 'XYC';
export const DEFAULT_CATALOG_FRM_PATTERN = '*.Frm';
export const DEFAULT_CATALOG_CATALOG_PATTERN = '*.Catalog.m';
export const DEFAULT_CATALOG_CATFCT_PATTERN = '*.Feature.CATfct';
export const DEFAULT_CATALOG_CATSPECS_PATTERN = '*.Feature.CATSpecs';

/**
 * Catalog 扫描与健康检查使用的命名规则
 */
export interface CaaCatalogNamingConfig {
    /** 模块名固定前缀，如 XYC */
    module_prefix: string;
    /** Frm 目录后缀，如 Frm（来自 *.Frm） */
    frm_suffix: string;
    /** Catalog.m 目录后缀，如 Catalog.m（来自 *.Catalog.m） */
    catalog_suffix: string;
    /** mkrun Catalog 命令后缀，如 Catalog */
    catalog_command_suffix: string;
    /** Feature 资源中间段，如 Feature（来自 *.Feature.CATfct） */
    feature_middle: string;
    /** CATfct 扩展名 */
    catfct_extension: string;
    /** CATSpecs 扩展名 */
    catspecs_extension: string;
}

const CONFIG_SECTION = 'caaComposer';

/**
 * 读取 Catalog 命名配置
 */
export function get_catalog_naming_config(): CaaCatalogNamingConfig {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    const frm_pattern = config.get<string>('catalog.frmPattern', DEFAULT_CATALOG_FRM_PATTERN);
    const catalog_pattern = config.get<string>(
        'catalog.catalogPattern',
        DEFAULT_CATALOG_CATALOG_PATTERN
    );
    const catfct_pattern = config.get<string>(
        'catalog.catfctPattern',
        DEFAULT_CATALOG_CATFCT_PATTERN
    );
    const catspecs_pattern = config.get<string>(
        'catalog.catspecsPattern',
        DEFAULT_CATALOG_CATSPECS_PATTERN
    );

    const catalog_suffix = parse_wildcard_suffix_(catalog_pattern, DEFAULT_CATALOG_CATALOG_PATTERN);
    const catfct_parts = parse_feature_file_pattern_(catfct_pattern, DEFAULT_CATALOG_CATFCT_PATTERN);
    const catspecs_parts = parse_feature_file_pattern_(catspecs_pattern, DEFAULT_CATALOG_CATSPECS_PATTERN);

    return {
        module_prefix: config.get<string>('catalog.modulePrefix', DEFAULT_CATALOG_MODULE_PREFIX).trim(),
        frm_suffix: parse_wildcard_suffix_(frm_pattern, DEFAULT_CATALOG_FRM_PATTERN),
        catalog_suffix,
        catalog_command_suffix: resolve_catalog_command_suffix_(catalog_suffix),
        feature_middle: catfct_parts.middle,
        catfct_extension: catfct_parts.extension,
        catspecs_extension: catspecs_parts.extension,
    };
}

/**
 * 侧边栏展示的命名规则摘要
 */
export function format_catalog_naming_hint(naming: CaaCatalogNamingConfig): string {
    return `${naming.module_prefix}*${naming.frm_suffix} / ${naming.module_prefix}*${naming.catalog_suffix}`;
}

/**
 * 从 Catalog 目录名解析模块名
 */
export function parse_module_name_from_catalog_dir(
    catalog_dir_name: string,
    naming: CaaCatalogNamingConfig
): string | undefined {
    const prefix = naming.module_prefix;
    const suffix = naming.catalog_suffix;

    if (!prefix || !catalog_dir_name.startsWith(prefix)) {
        return undefined;
    }
    if (!catalog_dir_name.endsWith(suffix)) {
        return undefined;
    }

    const module_name = catalog_dir_name.slice(0, -suffix.length);
    if (!module_name || module_name === prefix) {
        return undefined;
    }

    return module_name;
}

/**
 * 判断 Frm 目录名是否与模块名匹配
 */
export function is_matching_frm_dir(
    frm_dir_name: string,
    module_name: string,
    naming: CaaCatalogNamingConfig
): boolean {
    return frm_dir_name === resolve_frm_dir_name(module_name, naming);
}

/**
 * 解析 Frm 目录名
 */
export function resolve_frm_dir_name(module_name: string, naming: CaaCatalogNamingConfig): string {
    return `${module_name}${naming.frm_suffix}`;
}

/**
 * 解析 Catalog.m 目录名
 */
export function resolve_catalog_dir_name(module_name: string, naming: CaaCatalogNamingConfig): string {
    return `${module_name}${naming.catalog_suffix}`;
}

/**
 * 解析 mkrun Catalog 命令名（如 XYCFooCatalog）
 */
export function resolve_catalog_command_name(
    module_name: string,
    naming: CaaCatalogNamingConfig
): string {
    return `${module_name}${naming.catalog_command_suffix}`;
}

/**
 * 解析 Feature 资源主文件名（不含扩展名），如 XYCMyModuleFeature
 */
export function resolve_feature_stem(module_name: string, naming: CaaCatalogNamingConfig): string {
    return `${module_name}${naming.feature_middle}`;
}

/**
 * 解析 CATfct 文件名
 */
export function resolve_catfct_file_name(
    module_name: string,
    naming: CaaCatalogNamingConfig
): string {
    return `${resolve_feature_stem(module_name, naming)}.${naming.catfct_extension}`;
}

/**
 * 解析 CATSpecs 文件名
 */
export function resolve_catspecs_file_name(
    module_name: string,
    naming: CaaCatalogNamingConfig
): string {
    return `${resolve_feature_stem(module_name, naming)}.${naming.catspecs_extension}`;
}

/**
 * 解析 *.Suffix 模式中的后缀部分
 */
function parse_wildcard_suffix_(pattern: string, fallback_pattern: string): string {
    const normalized = pattern.trim() || fallback_pattern;
    if (normalized.startsWith('*.')) {
        return normalized.substring(2);
    }
    if (normalized.startsWith('*')) {
        return normalized.substring(1);
    }
    return normalized;
}

/**
 * 解析 *.Middle.Ext 特征文件模式
 */
function parse_feature_file_pattern_(
    pattern: string,
    fallback_pattern: string
): { middle: string; extension: string } {
    const normalized = pattern.trim() || fallback_pattern;
    const body = normalized.startsWith('*.') ? normalized.substring(2) : normalized;
    const dot_index = body.lastIndexOf('.');
    if (dot_index <= 0) {
        const fallback_body = fallback_pattern.startsWith('*.')
            ? fallback_pattern.substring(2)
            : fallback_pattern;
        const fallback_dot = fallback_body.lastIndexOf('.');
        return {
            middle: fallback_body.substring(0, fallback_dot),
            extension: fallback_body.substring(fallback_dot + 1),
        };
    }

    return {
        middle: body.substring(0, dot_index),
        extension: body.substring(dot_index + 1),
    };
}

/**
 * Catalog.m → Catalog（mkrun 命令用）
 */
function resolve_catalog_command_suffix_(catalog_suffix: string): string {
    if (catalog_suffix.toLowerCase().endsWith('.m')) {
        return catalog_suffix.slice(0, -2);
    }
    return catalog_suffix;
}
