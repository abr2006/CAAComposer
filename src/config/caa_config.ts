import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { t } from '../i18n/t';
import { CaaCatalogNamingConfig, get_catalog_naming_config } from './caa_catalog_naming';

/** RADE install runtime dir name (32-bit: intel_a, 64-bit: win_b64) */
export type RadeRuntimeDirName = 'win_b64' | 'intel_a';

/** Prefer win_b64, fallback intel_a */
const RADE_RUNTIME_DIR_CANDIDATES: readonly RadeRuntimeDirName[] = ['win_b64', 'intel_a'];

/**
 * CNEXT debug settings
 */
export interface CaaDebugConfig {
    /** Auto write .vscode/launch.json */
    auto_setup_launch_json: boolean;
    /** Auto attach CNEXT after test run */
    auto_attach_on_test_run: boolean;
    /** Process name to attach */
    process_name: string;
    /** Wait timeout for CNEXT (seconds) */
    attach_timeout_seconds: number;
}

/**
 * CAA Composer settings
 */
export interface CaaComposerConfig {
    /** RADE install root */
    rade_path: string;
    /** CATIA install root */
    catia_path: string;
    /** CATIA/RADE version shorthand, e.g. R20 */
    version: string;
    /** Run mkrtv.bat after build */
    run_mk_rtv: boolean;
    /** Load Visual Studio Developer Command Prompt first */
    use_dev_env_shell: boolean;
    /** Catalog naming rules */
    catalog: CaaCatalogNamingConfig;
    /** CNEXT debug */
    debug: CaaDebugConfig;
    /** C++ clang-format */
    format: CaaFormatConfig;
}

/**
 * clang-format settings
 */
export interface CaaFormatConfig {
    /** Auto write .clang-format and format settings */
    auto_setup_clang_format: boolean;
    /** Enable format on save in .vscode/settings.json */
    format_on_save: boolean;
}

const CONFIG_SECTION = 'caaComposer';

function msg_rade_not_configured(): string {
    return t('Set caaComposer.radePath (RADE install directory) in settings.');
}

function msg_catia_not_configured(): string {
    return t('Set caaComposer.catiaPath (CATIA install directory) in settings.');
}

function msg_version_not_configured(): string {
    return t(
        'Select caaComposer.version (e.g. R20 / R26) or set a full TCK profile (e.g. V5_6R2016_B26).'
    );
}

/** Classic V5Rn_Bn applies up to this level; higher levels use V5_6R{year}_Bn */
const TCK_CLASSIC_MAX_LEVEL = 21;

/**
 * Resolve tck_profile.bat argument from version setting and/or RADE Install.txt
 * - Full profile: V5R20_B20 / V5_6R2016_B26 (hyphen normalized to underscore)
 * - Shorthand: R20 → V5R20_B20; R26 → V5_6R2016_B26
 * - Empty version: read MARKETING_VERSION + BUILD_VERSION from RADE TCK\\Install.txt
 */
export function resolve_tck_profile(version: string, rade_path: string = ''): string {
    const from_version = map_version_to_tck_profile_(version);
    if (from_version) {
        return from_version;
    }

    return read_tck_profile_from_rade_install_(rade_path);
}

/**
 * Map version setting to TCK profile name
 */
function map_version_to_tck_profile_(version: string): string {
    const trimmed = version.trim();
    if (!trimmed) {
        return '';
    }

    const normalized = trimmed.replace(/-/g, '_');

    // Full TCK already: V5R20_B20 or V5_6R2016_B26
    if (/^V5R\d+_B\d+$/i.test(normalized) || /^V5_6R\d+_B\d+$/i.test(normalized)) {
        return normalized;
    }

    // Shorthand Rn / rn
    const level_match = trimmed.match(/^R(\d+)$/i);
    if (level_match) {
        const level = Number(level_match[1]);
        if (!Number.isFinite(level) || level <= 0) {
            return '';
        }
        if (level <= TCK_CLASSIC_MAX_LEVEL) {
            return `V5R${level}_B${level}`;
        }
        // V5-6R2012+ : year = 1990 + level (R26 → 2016 → V5_6R2016_B26)
        const year = 1990 + level;
        return `V5_6R${year}_B${level}`;
    }

    // Marketing year form: 2016 / V5_6R2016 / V5-6R2016
    const year_match = normalized.match(/^(?:V5_6R)?(20\d{2})$/i);
    if (year_match) {
        const year = Number(year_match[1]);
        const level = year - 1990;
        if (level > TCK_CLASSIC_MAX_LEVEL) {
            return `V5_6R${year}_B${level}`;
        }
    }

    return '';
}

/**
 * Read TCK profile from RADE TCK\\Install.txt (MARKETING_VERSION + BUILD_VERSION)
 */
function read_tck_profile_from_rade_install_(rade_path: string): string {
    const root = rade_path.trim();
    if (!root) {
        return '';
    }

    const runtime_dir = resolve_rade_runtime_dir_name(root);
    const install_txt = path.join(root, runtime_dir, 'TCK', 'Install.txt');
    if (!fs.existsSync(install_txt)) {
        return '';
    }

    let text = '';
    try {
        text = fs.readFileSync(install_txt, 'utf8');
    } catch {
        return '';
    }

    const marketing = text.match(/^\s*MARKETING_VERSION\s+(\S+)/im)?.[1]?.trim() ?? '';
    const build = text.match(/^\s*BUILD_VERSION\s+(\S+)/im)?.[1]?.trim() ?? '';
    if (!marketing || !build) {
        return '';
    }

    const marketing_norm = marketing.replace(/-/g, '_');
    const build_norm = build.startsWith('B') || build.startsWith('b') ? build : `B${build}`;
    return `${marketing_norm}_${build_norm}`;
}

/**
 * Read current workspace config
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
        debug: {
            auto_setup_launch_json: config.get<boolean>('debug.autoSetupLaunchJson', true),
            auto_attach_on_test_run: config.get<boolean>('debug.autoAttachOnTestRun', true),
            process_name: config.get<string>('debug.processName', 'CNEXT.exe'),
            attach_timeout_seconds: config.get<number>('debug.attachTimeoutSeconds', 120),
        },
        format: {
            auto_setup_clang_format: config.get<boolean>('format.autoSetupClangFormat', true),
            format_on_save: config.get<boolean>('format.formatOnSave', true),
        },
    };
}

/**
 * Read version; fallback to legacy tckProfile
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

    const classic = legacy_profile.match(/^V5R(\d+)_B\d+$/i);
    if (classic) {
        return `R${classic[1]}`;
    }

    const v56 = legacy_profile.match(/^V5[_-]?6R\d+_B(\d+)$/i);
    if (v56) {
        return `R${v56[1]}`;
    }

    return legacy_profile;
}

/**
 * Detect RADE runtime dir under install root (win_b64 / intel_a)
 * Prefers code\command\tck_init.bat; else first existing dir; default intel_a
 */
export function resolve_rade_runtime_dir_name(rade_path: string): RadeRuntimeDirName {
    const root = rade_path.trim();
    if (!root) {
        return 'intel_a';
    }

    for (const dir_name of RADE_RUNTIME_DIR_CANDIDATES) {
        const tck_init = path.join(root, dir_name, 'code', 'command', 'tck_init.bat');
        if (fs.existsSync(tck_init)) {
            return dir_name;
        }
    }

    for (const dir_name of RADE_RUNTIME_DIR_CANDIDATES) {
        try {
            const candidate = path.join(root, dir_name);
            if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
                return dir_name;
            }
        } catch {
            // try next
        }
    }

    return 'intel_a';
}

/**
 * Resolve RADE script dirs (auto intel_a / win_b64)
 */
export function resolve_rade_command_dirs(rade_path: string): {
    runtime_dir_name: RadeRuntimeDirName;
    command_dir: string;
    tck_command_dir: string;
} {
    const root = rade_path.trim();
    const runtime_dir_name = resolve_rade_runtime_dir_name(root);
    return {
        runtime_dir_name,
        command_dir: path.join(root, runtime_dir_name, 'code', 'command'),
        tck_command_dir: path.join(root, runtime_dir_name, 'TCK', 'command'),
    };
}

/**
 * Validate full CAA config
 */
export function validate_caa_config(config: CaaComposerConfig): string | undefined {
    if (!config.rade_path.trim()) {
        return msg_rade_not_configured();
    }
    if (!config.catia_path.trim()) {
        return msg_catia_not_configured();
    }
    if (!resolve_tck_profile(config.version, config.rade_path)) {
        return msg_version_not_configured();
    }
    return undefined;
}

/**
 * Validate RADE-only config for Catalog ops
 */
export function validate_rade_config(config: CaaComposerConfig): string | undefined {
    if (!config.rade_path.trim()) {
        return msg_rade_not_configured();
    }
    if (!resolve_tck_profile(config.version, config.rade_path)) {
        return msg_version_not_configured();
    }
    return undefined;
}

/**
 * Workspace root folder
 */
export function get_workspace_root(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return undefined;
    }
    return folders[0].uri.fsPath;
}
