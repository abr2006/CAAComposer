import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CaaBuilder, BuildResult } from '../build/caa_builder';
import { CaaComposerConfig, resolve_tck_profile, validate_rade_config } from '../config/caa_config';
import {
    resolve_catfct_file_name,
    resolve_catalog_command_name,
    resolve_catspecs_file_name,
    resolve_feature_stem,
    resolve_frm_dir_name,
} from '../config/caa_catalog_naming';
import { t } from '../i18n/t';

const MSG_RADE_SCRIPT_MISSING = () =>
    t('RADE script not found. Check caaComposer.radePath.');
const MSG_REGENERATE_STARTED = () =>
    t('Catalog regenerate started in the terminal. Check terminal output.');
const MSG_UPDATE_STARTED = () =>
    t('Catalog update started in the terminal. Check terminal output.');
const MSG_REPAIR_STARTED = () =>
    t('Catalog repair started in the terminal. Check terminal output.');
const MSG_REPAIR_CATFCT_MISSING = () =>
    t('Configured CATfct file not found. Ensure Catalog exists before repair.');

/**
 * 组装 Catalog 更新批处理命令（就地 mkrun 更新 graphic）
 * @param module_name 模块名，如 XYCRandomPattern
 * @param config 插件配置（使用 radePath、version）
 */
export function build_catalog_update_batch_lines(
    module_name: string,
    config: CaaComposerConfig
): string[] {
    const rade_path = config.rade_path.trim();
    const tck_profile = resolve_tck_profile(config.version);
    const command_dir = path.join(rade_path, 'intel_a', 'code', 'command');
    const tck_command_dir = path.join(rade_path, 'intel_a', 'TCK', 'command');

    const naming = config.catalog;
    const frm_dir = `.\\${resolve_frm_dir_name(module_name, naming)}`;
    const graphic_dir = `${frm_dir}\\CNext\\resources\\graphic`;
    const catalog_command = resolve_catalog_command_name(module_name, naming);
    const catfct_ext = naming.catfct_extension;

    return [
        'if not exist "C:\\temp" mkdir "C:\\temp"',
        `call "${path.join(command_dir, 'tck_init.bat')}"`,
        `call "${path.join(tck_command_dir, 'tck_profile.bat')}" ${tck_profile}`,
        `call "${path.join(command_dir, 'mkCreateRuntimeView.bat')}"`,
        `call "${path.join(command_dir, 'mkrun.bat')}" -c "${catalog_command} ${graphic_dir}"`,
        'if not exist ".\\win_b64\\resources\\graphic" mkdir ".\\win_b64\\resources\\graphic"',
        `copy /y "${graphic_dir}\\*.${catfct_ext}" ".\\win_b64\\resources\\graphic\\"`,
    ];
}

/**
 * 组装 Catalog 修复批处理命令（对应 update.bat，BackupStartUp 修复 FeatureBackUpGeoElem3D）
 * @param module_name 模块名，如 XYCRandomPattern
 * @param config 插件配置（使用 radePath、version）
 */
export function build_catalog_repair_batch_lines(
    module_name: string,
    config: CaaComposerConfig
): string[] {
    const rade_path = config.rade_path.trim();
    const tck_profile = resolve_tck_profile(config.version);
    const command_dir = path.join(rade_path, 'intel_a', 'code', 'command');
    const tck_command_dir = path.join(rade_path, 'intel_a', 'TCK', 'command');

    const naming = config.catalog;
    const frm_dir = `.\\${resolve_frm_dir_name(module_name, naming)}`;
    const graphic_dir = `${frm_dir}\\CNext\\resources\\graphic`;
    const feature_name = resolve_feature_stem(module_name, naming);
    const catfct_path = `${graphic_dir}\\${resolve_catfct_file_name(module_name, naming)}`;
    const catfct_ext = naming.catfct_extension;

    return [
        'if not exist "C:\\temp" mkdir "C:\\temp"',
        `if not exist "${catfct_path}" (`,
        `    echo ERROR: ${resolve_catfct_file_name(module_name, naming)} not found.`,
        '    echo Please ensure the catalog exists before running this script.',
        '    exit /b 1',
        ')',
        `call "${path.join(command_dir, 'tck_init.bat')}"`,
        `call "${path.join(tck_command_dir, 'tck_profile.bat')}" ${tck_profile}`,
        `call "${path.join(command_dir, 'mkCreateRuntimeView.bat')}"`,
        `if exist "C:\\temp\\${feature_name}.${catfct_ext}" del /q "C:\\temp\\${feature_name}.${catfct_ext}"`,
        `call "${path.join(command_dir, 'mkrun.bat')}" -c "CATMmrBackupStartUpTool ${feature_name}.${catfct_ext} ${graphic_dir} C:\\temp ${module_name}ID"`,
        `if exist "C:\\temp\\${feature_name}.${catfct_ext}" (`,
        `    copy /y "C:\\temp\\${feature_name}.${catfct_ext}" "${graphic_dir}\\"`,
        ')',
        'if not exist ".\\win_b64\\resources\\graphic" mkdir ".\\win_b64\\resources\\graphic"',
        `copy /y "${graphic_dir}\\*.${catfct_ext}" ".\\win_b64\\resources\\graphic\\"`,
    ];
}

/**
 * 组装 Catalog 重新生成批处理命令（删除后通过 C:\\temp 重建 Feature）
 * @param module_name 模块名，如 XYCRandomPattern
 * @param config 插件配置（使用 radePath、version）
 */
export function build_catalog_regenerate_batch_lines(
    module_name: string,
    config: CaaComposerConfig
): string[] {
    const rade_path = config.rade_path.trim();
    const tck_profile = resolve_tck_profile(config.version);
    const command_dir = path.join(rade_path, 'intel_a', 'code', 'command');
    const tck_command_dir = path.join(rade_path, 'intel_a', 'TCK', 'command');

    const naming = config.catalog;
    const frm_dir = `.\\${resolve_frm_dir_name(module_name, naming)}`;
    const graphic_dir = `${frm_dir}\\CNext\\resources\\graphic`;
    const feature_name = resolve_feature_stem(module_name, naming);
    const catfct_file = resolve_catfct_file_name(module_name, naming);
    const catspecs_file = resolve_catspecs_file_name(module_name, naming);
    const catalog_command = resolve_catalog_command_name(module_name, naming);
    const catfct_ext = naming.catfct_extension;
    const catspecs_ext = naming.catspecs_extension;

    return [
        'if not exist "C:\\temp" mkdir "C:\\temp"',
        `del "${graphic_dir}\\${catfct_file}"`,
        `del "${graphic_dir}\\${catspecs_file}"`,
        `call "${path.join(command_dir, 'tck_init.bat')}"`,
        `call "${path.join(tck_command_dir, 'tck_profile.bat')}" ${tck_profile}`,
        `call "${path.join(command_dir, 'mkCreateRuntimeView.bat')}"`,
        `if exist "C:\\temp\\${catfct_file}" del /q "C:\\temp\\${catfct_file}"`,
        `call "${path.join(command_dir, 'mkrun.bat')}" -c "${catalog_command} C:\\temp"`,
        `call "${path.join(command_dir, 'mkrun.bat')}" -c "CATMmrBackupStartUpTool ${catfct_file} C:\\temp ${graphic_dir} ${module_name}ID"`,
        `copy /y "C:\\temp\\*.${catspecs_ext}" "${graphic_dir}"`,
        'if not exist ".\\win_b64\\resources\\graphic" mkdir ".\\win_b64\\resources\\graphic"',
        `copy /y "${graphic_dir}\\*.${catfct_ext}" ".\\win_b64\\resources\\graphic\\"`,
    ];
}

/**
 * Catalog 重新生成 / 更新执行器
 */
export class CaaCatalogRegenerator {
    private builder_: CaaBuilder;
    private output_channel_: vscode.OutputChannel;

    constructor(builder: CaaBuilder, output_channel: vscode.OutputChannel) {
        this.builder_ = builder;
        this.output_channel_ = output_channel;
    }

    /**
     * 更新指定模块 Catalog（就地 mkrun 更新 graphic）
     * @param module_name 模块名，如 XYCRandomPattern
     * @param workspace_root 工作区根目录
     * @param config 插件配置
     */
    async update(
        module_name: string,
        workspace_root: string,
        config: CaaComposerConfig
    ): Promise<BuildResult> {
        return this.run_catalog_action_(
            module_name,
            workspace_root,
            config,
            build_catalog_update_batch_lines(module_name, config),
            t('Catalog update'),
            `${MSG_UPDATE_STARTED()} (${module_name})`
        );
    }

    /**
     * 修复指定模块 Catalog（BackupStartUpTool，对应 update.bat）
     * @param module_name 模块名，如 XYCRandomPattern
     * @param workspace_root 工作区根目录
     * @param config 插件配置
     */
    async repair(
        module_name: string,
        workspace_root: string,
        config: CaaComposerConfig
    ): Promise<BuildResult> {
        const naming = config.catalog;
        const catfct_path = path.join(
            workspace_root,
            resolve_frm_dir_name(module_name, naming),
            'CNext',
            'resources',
            'graphic',
            resolve_catfct_file_name(module_name, naming)
        );
        if (!fs.existsSync(catfct_path)) {
            const missing_msg = MSG_REPAIR_CATFCT_MISSING();
            this.output_channel_.appendLine(t('[Error] {0}', missing_msg));
            this.output_channel_.appendLine(`  ${catfct_path}`);
            vscode.window.showErrorMessage(missing_msg);
            return { success: false, exit_code: -1, output: missing_msg };
        }

        return this.run_catalog_action_(
            module_name,
            workspace_root,
            config,
            build_catalog_repair_batch_lines(module_name, config),
            t('Catalog repair'),
            `${MSG_REPAIR_STARTED()} (${module_name})`
        );
    }

    /**
     * 重新生成指定模块 Catalog 资源
     * @param module_name 模块名，如 XYCRandomPattern
     * @param workspace_root 工作区根目录
     * @param config 插件配置
     */
    async regenerate(
        module_name: string,
        workspace_root: string,
        config: CaaComposerConfig
    ): Promise<BuildResult> {
        return this.run_catalog_action_(
            module_name,
            workspace_root,
            config,
            build_catalog_regenerate_batch_lines(module_name, config),
            t('Catalog regenerate'),
            `${MSG_REGENERATE_STARTED()} (${module_name})`
        );
    }

    /**
     * 执行 Catalog 批处理动作
     */
    private async run_catalog_action_(
        module_name: string,
        workspace_root: string,
        config: CaaComposerConfig,
        batch_lines: string[],
        action_label: string,
        started_message: string
    ): Promise<BuildResult> {
        const validation_error = validate_rade_config(config);
        if (validation_error) {
            this.output_channel_.appendLine(t('[Error] {0}', validation_error));
            vscode.window.showErrorMessage(validation_error);
            return { success: false, exit_code: -1, output: validation_error };
        }

        const missing_script = find_missing_script_(batch_lines);
        if (missing_script) {
            const message = `${MSG_RADE_SCRIPT_MISSING()}: ${missing_script}`;
            this.output_channel_.appendLine(t('[Error] {0}', message));
            vscode.window.showErrorMessage(message);
            return { success: false, exit_code: -1, output: message };
        }

        this.output_channel_.appendLine(t('[CAA Composer] Workspace: {0}', workspace_root));
        this.output_channel_.appendLine(t('[CAA Composer] Action: {0}', action_label));
        this.output_channel_.appendLine(t('[CAA Composer] Module: {0}', module_name));
        this.output_channel_.appendLine(`[CAA Composer] RADE: ${config.rade_path}`);
        this.output_channel_.appendLine(t('[CAA Composer] Version: {0}', config.version));
        this.output_channel_.appendLine(
            `[CAA Composer] Profile: ${resolve_tck_profile(config.version)}`
        );
        this.output_channel_.appendLine(t('[CAA Composer] Command sequence:'));
        for (const line of batch_lines) {
            this.output_channel_.appendLine(`  ${line}`);
        }
        this.output_channel_.appendLine('---');

        return this.builder_.run_workspace_batch(batch_lines, workspace_root, {
            use_dev_env_shell: config.use_dev_env_shell,
            started_message,
            terminal_name: 'CAA Catalog',
        });
    }
}

/**
 * 检查 call 引用的 bat 是否存在
 */
function find_missing_script_(batch_lines: string[]): string | undefined {
    for (const line of batch_lines) {
        const match = line.match(/^call "([^"]+)"/);
        if (!match) {
            continue;
        }
        if (!fs.existsSync(match[1])) {
            return match[1];
        }
    }
    return undefined;
}
