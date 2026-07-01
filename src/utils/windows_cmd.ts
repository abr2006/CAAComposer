/**
 * Windows cmd.exe 引号与活动终端执行封装
 */

/**
 * 为 cmd 引号包裹路径或参数（内部双引号加倍）
 */
export function quote_cmd_string(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
}

/**
 * 生成 call "path\to\script.bat"（脚本内应自行 cd 到工作区）
 */
export function build_call_batch_command(bat_path: string): string {
    return `call ${quote_cmd_string(bat_path)}`;
}

/**
 * 在活动终端（可能是 PowerShell）中通过 cmd /c 执行批处理命令
 */
export function wrap_cmd_for_active_terminal(command: string): string {
    return `cmd /c ${quote_cmd_string(command)}`;
}
