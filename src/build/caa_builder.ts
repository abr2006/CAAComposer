import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    CaaComposerConfig,
    resolve_rade_command_dirs,
    resolve_tck_profile,
    validate_caa_config,
} from '../config/caa_config';
import { t } from '../i18n/t';
import { run_build_artifacts_cleanup } from '../tools/cleanup_service';
import {
    build_call_batch_command,
    wrap_cmd_for_active_terminal,
} from '../utils/windows_cmd';

export type BuildAction = 'build' | 'test-run' | 'clean';

export interface BuildResult {
    success: boolean;
    exit_code: number;
    output: string;
}

const MSG_BUILD_STARTED = () =>
    t('CAA build started in the terminal. Check terminal output.');
const MSG_CLEAN_DONE = (count: number) =>
    t('Build artifacts removed ({0} item(s))', count);
const MSG_TEST_RUN_STARTED = () =>
    t('CAA test run started in the terminal. Check terminal output.');
const MSG_RADE_SCRIPT_MISSING = () =>
    t('RADE script not found. Check caaComposer.radePath.');
const MSG_VS_DEVCMD_NOT_FOUND = () =>
    t(
        '[Warning] VS Developer Command Prompt not found; running RADE scripts directly (compile environment may be incomplete).'
    );

/** ???????????????????????????mkmk/mkrun ???????????????? */
const WORKSPACE_BAT_NAME = '.caa-composer-run.bat';

/**
 * CAA ???????????RADE tck_init / tck_profile / mkGetPreq / mkmk / mkrtv??
 */
export class CaaBuilder {
    private output_channel_: vscode.OutputChannel;

    constructor(output_channel: vscode.OutputChannel) {
        this.output_channel_ = output_channel;
    }

    /**
     * ??? CAA ????????
     * @param action ????????
     * @param workspace_root ??????????
     * @param config ???????
     */
    async run(
        action: BuildAction,
        workspace_root: string,
        config: CaaComposerConfig
    ): Promise<BuildResult> {
        if (action === 'clean') {
            return this.clean_artifacts_(workspace_root);
        }

        const validation_error = validate_caa_config(config);
        if (validation_error) {
            this.output_channel_.appendLine(t('[Error] {0}', validation_error));
            vscode.window.showErrorMessage(validation_error);
            return { success: false, exit_code: -1, output: validation_error };
        }

        const batch_lines = this.build_batch_lines_(action, config);
        const missing_script = this.find_missing_script_(batch_lines);
        if (missing_script) {
            const message = `${MSG_RADE_SCRIPT_MISSING()}: ${missing_script}`;
            this.output_channel_.appendLine(t('[Error] {0}', message));
            vscode.window.showErrorMessage(message);
            return { success: false, exit_code: -1, output: message };
        }

        this.output_channel_.appendLine(t('[CAA Composer] Workspace: {0}', workspace_root));
        this.output_channel_.appendLine(t('[CAA Composer] Action: {0}', action));
        const rade_dirs = resolve_rade_command_dirs(config.rade_path);
        this.output_channel_.appendLine(`[CAA Composer] RADE: ${config.rade_path}`);
        this.output_channel_.appendLine(
            `[CAA Composer] RADE runtime: ${rade_dirs.runtime_dir_name}`
        );
        this.output_channel_.appendLine(`[CAA Composer] CATIA: ${config.catia_path}`);
        this.output_channel_.appendLine(t('[CAA Composer] Version: {0}', config.version));
        this.output_channel_.appendLine(
            `[CAA Composer] Profile: ${resolve_tck_profile(config.version, config.rade_path)}`
        );
        this.output_channel_.appendLine(t('[CAA Composer] Command sequence:'));
        for (const line of batch_lines) {
            this.output_channel_.appendLine(`  ${line}`);
        }
        this.output_channel_.appendLine('---');

        const message =
            action === 'test-run' ? MSG_TEST_RUN_STARTED() : MSG_BUILD_STARTED();
        return this.execute_in_terminal_(batch_lines, workspace_root, {
            use_dev_env_shell: config.use_dev_env_shell && action !== 'test-run',
            started_message: message,
            terminal_name: 'CAA Build',
        });
    }

    /**
     * ???????????????????????????
     * @param batch_lines ?????????????????? @echo off / cd??
     * @param workspace_root ??????????
     * @param options ??????
     */
    async run_workspace_batch(
        batch_lines: string[],
        workspace_root: string,
        options: {
            use_dev_env_shell: boolean;
            started_message: string;
            terminal_name?: string;
        }
    ): Promise<BuildResult> {
        return this.execute_in_terminal_(batch_lines, workspace_root, {
            use_dev_env_shell: options.use_dev_env_shell,
            started_message: options.started_message,
            terminal_name: options.terminal_name ?? 'CAA Build',
        });
    }

    /**
     * ??? RADE ??????????????????
     */
    private build_batch_lines_(action: BuildAction, config: CaaComposerConfig): string[] {
        const { command_dir, tck_command_dir } = resolve_rade_command_dirs(config.rade_path);
        const tck_profile = resolve_tck_profile(config.version, config.rade_path);

        if (action === 'test-run') {
            return [
                'if not exist "C:\\temp" mkdir "C:\\temp"',
                `call "${path.join(command_dir, 'tck_init.bat')}"`,
                `call "${path.join(tck_command_dir, 'tck_profile.bat')}" ${tck_profile}`,
                `call "${path.join(command_dir, 'mkCreateRuntimeView.bat')}"`,
                `call "${path.join(command_dir, 'mkrun.bat')}" -c "cnext"`,
            ];
        }

        const lines: string[] = [
            'cls',
            `call "${path.join(command_dir, 'tck_init.bat')}"`,
            `call "${path.join(tck_command_dir, 'tck_profile.bat')}" ${tck_profile}`,
            `call "${path.join(command_dir, 'mkGetPreq.bat')}" -p "${config.catia_path.trim()}"`,
        ];

        const mkmk_args = '-au';
        lines.push(`call "${path.join(command_dir, 'mkmk.bat')}" ${mkmk_args}`);

        if (config.run_mk_rtv) {
            lines.push(`call "${path.join(command_dir, 'mkrtv.bat')}"`);
        }

        return lines;
    }

    /**
     * ????????? win_b64 ??????????bin ??????????????
     */
    private async clean_artifacts_(workspace_root: string): Promise<BuildResult> {
        this.output_channel_.appendLine(t('[CAA Composer] Workspace: {0}', workspace_root));
        this.output_channel_.appendLine(t('[CAA Composer] Action: Remove build artifacts'));
        this.output_channel_.appendLine('---');

        const result = run_build_artifacts_cleanup(workspace_root);
        for (const line of result.log_lines) {
            this.output_channel_.appendLine(line);
        }

        this.output_channel_.appendLine('---');
        const summary = MSG_CLEAN_DONE(result.removed_count);
        this.output_channel_.appendLine(t('[Info] {0}', summary));

        if (result.error_count > 0) {
            const message = t('Cleanup finished with {0} failure(s)', result.error_count);
            vscode.window.showWarningMessage(message);
            return { success: false, exit_code: 1, output: message };
        }

        vscode.window.showInformationMessage(summary);
        return { success: true, exit_code: 0, output: summary };
    }

    /**
     * ??? call ????? bat ??????
     */
    private find_missing_script_(batch_lines: string[]): string | undefined {
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

    /**
     * ??????????????????????????????? cd ???????????? mkmk/mkrun ????
     */
    private write_workspace_bat_(workspace_root: string, batch_lines: string[]): string {
        const bat_path = path.join(workspace_root, WORKSPACE_BAT_NAME);
        const body = batch_lines.filter((line) => line !== '@echo off');
        const script_lines = ['@echo off', 'cd /d "%~dp0"', ...body];
        fs.writeFileSync(bat_path, script_lines.join('\r\n') + '\r\n', 'utf8');
        return bat_path;
    }

    /**
     * ????????????????????????????????????????????? cmd.exe
     */
    private execute_in_terminal_(
        batch_lines: string[],
        workspace_root: string,
        options: {
            use_dev_env_shell: boolean;
            started_message: string;
            terminal_name: string;
        }
    ): Promise<BuildResult> {
        return new Promise((resolve) => {
            let script_lines = [...batch_lines];

            if (options.use_dev_env_shell) {
                const dev_cmd = this.find_vs_dev_cmd_();
                if (dev_cmd) {
                    script_lines.unshift(`call "${dev_cmd}"`);
                } else {
                    this.output_channel_.appendLine(MSG_VS_DEVCMD_NOT_FOUND());
                }
            }

            const bat_path = this.write_workspace_bat_(workspace_root, script_lines);

            const active_terminal = vscode.window.activeTerminal;
            const terminal = active_terminal ?? vscode.window.createTerminal({
                name: options.terminal_name,
                cwd: workspace_root,
                shellPath: this.resolve_cmd_shell_(),
            });

            terminal.show();

            // .caa-composer-run.bat ???? cd /d "%~dp0"???????????? cd
            const bat_invoke = build_call_batch_command(bat_path);
            const command = active_terminal
                ? wrap_cmd_for_active_terminal(bat_invoke)
                : bat_invoke;
            terminal.sendText(command);

            this.output_channel_.appendLine(t('[Info] {0}', options.started_message));
            vscode.window.showInformationMessage(options.started_message);

            resolve({
                success: true,
                exit_code: 0,
                output: options.started_message,
            });
        });
    }

    /**
     * ??? Windows cmd.exe ????
     */
    private resolve_cmd_shell_(): string {
        return process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe';
    }

    /**
     * ???? Visual Studio ???????????????
     */
    private find_vs_dev_cmd_(): string | undefined {
        const program_files = process.env['ProgramFiles(x86)'] ?? process.env.ProgramFiles;
        if (!program_files) {
            return undefined;
        }

        const candidates = [
            path.join(program_files, 'Microsoft Visual Studio', '2022', 'Community', 'Common7', 'Tools', 'VsDevCmd.bat'),
            path.join(program_files, 'Microsoft Visual Studio', '2022', 'Professional', 'Common7', 'Tools', 'VsDevCmd.bat'),
            path.join(program_files, 'Microsoft Visual Studio', '2022', 'Enterprise', 'Common7', 'Tools', 'VsDevCmd.bat'),
            path.join(program_files, 'Microsoft Visual Studio', '2019', 'Community', 'Common7', 'Tools', 'VsDevCmd.bat'),
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        return undefined;
    }
}
