import * as vscode from 'vscode';
import { t } from '../i18n/t';
import { CaaCatalogNamingConfig, get_catalog_naming_config } from './caa_catalog_naming';

/**
 * CAA 插件配置项
 */
export interface CaaComposerConfig {
    /** RADE 安装根目录 */
    rade_path: string;
    /** CATIA 安装根目录 */
    catia_path: string;
    /** CATIA/RADE 版本简写，如 R20 */
    version: string;
    /** 编译完成后是否执行 mkrtv.bat */
    run_mk_rtv: boolean;
    /** 是否先加载 Visual Studio 开发者命令行环境 */
    use_dev_env_shell: boolean;
    /** Catalog 命名规则 */
    catalog: CaaCatalogNamingConfig;
}

const CONFIG_SECTION = 'caaComposer';

function msg_rade_not_configured(): string {
    return t('Set caaComposer.radePath (RADE install directory) in settings.');
}

function msg_catia_not_configured(): string {
    return t('Set caaComposer.catiaPath (CATIA install directory) in settings.');
}

function msg_version_not_configured(): string {
    return t('Select caaComposer.version in settings (e.g. R20).');
}

/**
 * 由版本简写组合 TCK Profile 名称
 * @param version 版本简写，如 R20
 * @returns TCK Profile，如 V5R20_B20；无法解析时返回空字符串
 */
export function resolve_tck_profile(version: string): string {
    const trimmed = version.trim();
    if (!trimmed) {
        return '';
    }

    const match = trimmed.match(/^R(\d+)$/i);
    if (match) {
        const num = match[1];
        return `V5R${num}_B${num}`;
    }

    if (/^V5R\d+_B\d+$/i.test(trimmed)) {
        return trimmed;
    }

    return '';
}

/**
 * 读取当前工作区配置
 * @returns CAA 插件配置
 */
export function get_caa_config(): CaaComposerConfig {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    return {
        rade_path: config.get<string>('radePath', ''),
        catia_path: config.get<string>('catiaPath', ''),
        version: read_version_(config),
        run_mk_rtv: config.get<boolean>('runMkRtv', true),
        use_dev_env_shell: config.get<boolean>('useDevEnvShell', true),
        catalog: get_catalog_naming_config(),
    };
}

/**
 * 读取版本配置，兼容旧版 tckProfile
 */
function read_version_(config: vscode.WorkspaceConfiguration): string {
    const version = config.get<string>('version', '').trim();
    if (version) {
        return version;
    }

    const legacy_profile = config.get<string>('tckProfile', '').trim();
    if (!legacy_profile) {
        return '';
    }

    const match = legacy_profile.match(/^V5R(\d+)_B\d+$/i);
    if (match) {
        return `R${match[1]}`;
    }

    return '';
}

/**
 * 校验配置是否完整
 * @returns 错误信息，配置合法时返回 undefined
 */
export function validate_caa_config(config: CaaComposerConfig): string | undefined {
    if (!config.rade_path.trim()) {
        return msg_rade_not_configured();
    }
    if (!config.catia_path.trim()) {
        return msg_catia_not_configured();
    }
    if (!config.version.trim() || !resolve_tck_profile(config.version)) {
        return msg_version_not_configured();
    }
    return undefined;
}

/**
 * 校验 Catalog 操作所需的 RADE 配置
 * @returns 错误信息，配置合法时返回 undefined
 */
export function validate_rade_config(config: CaaComposerConfig): string | undefined {
    if (!config.rade_path.trim()) {
        return msg_rade_not_configured();
    }
    if (!config.version.trim() || !resolve_tck_profile(config.version)) {
        return msg_version_not_configured();
    }
    return undefined;
}

/**
 * 获取工作区根目录
 * @returns 首个工作区文件夹路径，未打开工作区时返回 undefined
 */
export function get_workspace_root(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return undefined;
    }
    return folders[0].uri.fsPath;
}
