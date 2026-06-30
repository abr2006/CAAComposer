import * as path from 'path';
import * as vscode from 'vscode';
import { check_catalog_health, is_catalog_missing } from '../catalog/caa_catalog_health';
import { CaaCatalogEntry, scan_caa_catalogs } from '../catalog/caa_catalog_scanner';
import { get_caa_config, get_workspace_root, resolve_tck_profile } from '../config/caa_config';
import { format_catalog_naming_hint } from '../config/caa_catalog_naming';

/**
 * 侧边栏树节点
 */
export class CaaTreeItem extends vscode.TreeItem {
    readonly group_id_?: string;
    readonly catalog_entry_?: CaaCatalogEntry;

    constructor(
        label: string,
        collapsible_state: vscode.TreeItemCollapsibleState,
        options?: {
            group_id?: string;
            command_id?: string;
            icon?: string;
            icon_color?: vscode.ThemeColor;
            description?: string;
            tooltip?: string;
            catalog_entry?: CaaCatalogEntry;
            context_value?: string;
            id?: string;
        }
    ) {
        super(label, collapsible_state);
        this.group_id_ = options?.group_id;
        this.catalog_entry_ = options?.catalog_entry;

        if (options?.id) {
            this.id = options.id;
        }

        if (options?.description) {
            this.description = options.description;
        }
        if (options?.tooltip) {
            this.tooltip = options.tooltip;
        }
        if (options?.icon) {
            this.iconPath = options.icon_color
                ? new vscode.ThemeIcon(options.icon, options.icon_color)
                : new vscode.ThemeIcon(options.icon);
        }
        if (options?.context_value) {
            this.contextValue = options.context_value;
        }
        if (options?.command_id) {
            this.command = {
                command: options.command_id,
                title: label,
            };
        }
    }
}

/**
 * CAA Composer 左侧边栏树视图
 */
export class CaaSidebarProvider implements vscode.TreeDataProvider<CaaTreeItem> {
    private on_did_change_tree_data_ = new vscode.EventEmitter<CaaTreeItem | undefined>();
    readonly onDidChangeTreeData = this.on_did_change_tree_data_.event;
    private refresh_generation_ = 0;

    /**
     * 刷新侧边栏；full_rescan 为 true 时完整重扫 Catalog 并提示结果
     */
    refresh(full_rescan = false): void {
        this.refresh_generation_++;

        if (full_rescan) {
            const workspace_root = get_workspace_root();
            if (workspace_root) {
                const config = get_caa_config();
                const catalogs = scan_caa_catalogs(workspace_root, config.catalog);
                let ok_count = 0;
                let issue_count = 0;

                for (const entry of catalogs) {
                    const health = check_catalog_health(
                        entry.frm_path,
                        entry.module_name,
                        workspace_root,
                        config.catalog
                    );
                    if (is_catalog_missing(health) || health.need_repair) {
                        issue_count++;
                    } else {
                        ok_count++;
                    }
                }

                void vscode.window.setStatusBarMessage(
                    `Catalog \u5df2\u66f4\u65b0\uff1a${catalogs.length} \u9879\uff08\u6b63\u5e38 ${ok_count}\uff0c\u5f02\u5e38 ${issue_count}\uff09`,
                    3000
                );
            }
        }

        this.on_did_change_tree_data_.fire(undefined);
    }

    getTreeItem(element: CaaTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CaaTreeItem): Thenable<CaaTreeItem[]> {
        if (element?.group_id_) {
            return Promise.resolve(this.get_group_children_(element.group_id_));
        }
        return Promise.resolve(this.get_root_children_());
    }

    /**
     * 根节点：分组标题
     */
    private get_root_children_(): CaaTreeItem[] {
        return [
            new CaaTreeItem('构建操作', vscode.TreeItemCollapsibleState.Expanded, {
                group_id: 'build',
                icon: 'tools',
            }),
            new CaaTreeItem('Catalog', vscode.TreeItemCollapsibleState.Expanded, {
                group_id: 'catalog',
                icon: 'library',
            }),
            new CaaTreeItem('配置', vscode.TreeItemCollapsibleState.Expanded, {
                group_id: 'config',
                icon: 'settings-gear',
            }),
        ];
    }

    /**
     * 分组子节点
     */
    private get_group_children_(group_id: string): CaaTreeItem[] {
        if (group_id === 'build') {
            return [
                new CaaTreeItem('编译当前工作区', vscode.TreeItemCollapsibleState.None, {
                    command_id: 'caa-composer.build',
                    icon: 'gear',
                }),
                new CaaTreeItem('测试运行', vscode.TreeItemCollapsibleState.None, {
                    command_id: 'caa-composer.testRun',
                    icon: 'play',
                }),
                new CaaTreeItem('删除构建产物', vscode.TreeItemCollapsibleState.None, {
                    command_id: 'caa-composer.clean',
                    icon: 'trash',
                }),
            ];
        }

        if (group_id === 'catalog') {
            const workspace_root = get_workspace_root();
            if (!workspace_root) {
                return [
                    new CaaTreeItem('未打开工作区', vscode.TreeItemCollapsibleState.None, {
                        icon: 'warning',
                        description: '请先打开文件夹',
                    }),
                ];
            }

            const config = get_caa_config();
            const naming = config.catalog;
            const catalogs = scan_caa_catalogs(workspace_root, naming);
            if (catalogs.length === 0) {
                return [
                    new CaaTreeItem('未找到 Catalog', vscode.TreeItemCollapsibleState.None, {
                        icon: 'info',
                        description: format_catalog_naming_hint(naming),
                    }),
                ];
            }

            return catalogs.map((entry) => this.create_catalog_tree_item_(entry, workspace_root, naming));
        }

        if (group_id === 'config') {
            const config = get_caa_config();
            const rade_path = config.rade_path || '\u672a\u914d\u7f6e';
            const catia_path = config.catia_path || '\u672a\u914d\u7f6e';
            const version = config.version || '\u672a\u914d\u7f6e';

            return [
                new CaaTreeItem('RADE \u8def\u5f84', vscode.TreeItemCollapsibleState.None, {
                    icon: 'server-environment',
                    description: this.shorten_path_(rade_path),
                    tooltip: rade_path,
                }),
                new CaaTreeItem('CATIA \u8def\u5f84', vscode.TreeItemCollapsibleState.None, {
                    icon: 'server',
                    description: this.shorten_path_(catia_path),
                    tooltip: catia_path,
                }),
                new CaaTreeItem('\u7248\u672c', vscode.TreeItemCollapsibleState.None, {
                    icon: 'symbol-property',
                    description: version,
                    tooltip: version ? resolve_tck_profile(version) : undefined,
                }),
                new CaaTreeItem('Catalog 前缀', vscode.TreeItemCollapsibleState.None, {
                    icon: 'symbol-string',
                    description: config.catalog.module_prefix || '\u672a\u914d\u7f6e',
                }),
                new CaaTreeItem('Catalog 命名', vscode.TreeItemCollapsibleState.None, {
                    icon: 'symbol-file',
                    description: format_catalog_naming_hint(config.catalog),
                    tooltip: [
                        `Frm: *.${config.catalog.frm_suffix}`,
                        `Catalog: *.${config.catalog.catalog_suffix}`,
                        `CATfct: *.${config.catalog.feature_middle}.${config.catalog.catfct_extension}`,
                        `CATSpecs: *.${config.catalog.feature_middle}.${config.catalog.catspecs_extension}`,
                    ].join('\n'),
                }),
                new CaaTreeItem('\u6253\u5f00\u8bbe\u7f6e', vscode.TreeItemCollapsibleState.None, {
                    command_id: 'caa-composer.openSettings',
                    icon: 'settings',
                }),
            ];
        }

        return [];
    }

    /**
     * 构建 Catalog 树节点（含健康状态 contextValue，供行内图标与按钮使用）
     */
    private create_catalog_tree_item_(
        entry: CaaCatalogEntry,
        workspace_root: string,
        naming: ReturnType<typeof get_caa_config>['catalog']
    ): CaaTreeItem {
        const health = check_catalog_health(
            entry.frm_path,
            entry.module_name,
            workspace_root,
            naming
        );
        const status = this.resolve_catalog_status_(health);
        const catfct_pattern = `*.${naming.feature_middle}.${naming.catfct_extension}`;
        const catspecs_pattern = `*.${naming.feature_middle}.${naming.catspecs_extension}`;

        const tooltip_lines = [
            entry.frm_path,
            entry.catalog_path,
            `\u72b6\u6001: ${status.description}`,
        ];
        for (const catfct_path of health.checked_catfct_paths) {
            tooltip_lines.push(`${naming.catfct_extension}: ${catfct_path}`);
        }
        if (health.need_repair) {
            tooltip_lines.push('CATfct \u7f3a\u5c11 FeatureBackUpGeoElem3D');
        }
        if (health.missing_catfct) {
            tooltip_lines.push(`\u7f3a\u5c11 ${catfct_pattern}`);
        }
        if (health.missing_catspecs) {
            tooltip_lines.push(`\u7f3a\u5c11 ${catspecs_pattern}`);
        }

        return new CaaTreeItem(entry.module_name, vscode.TreeItemCollapsibleState.None, {
            id: `catalog-${entry.module_name}-${this.refresh_generation_}`,
            icon: status.icon,
            icon_color: status.icon_color,
            catalog_entry: entry,
            context_value: status.context_value,
            description: status.description,
            tooltip: tooltip_lines.join('\n'),
        });
    }

    /**
     * 根据健康检查结果解析行图标与状态文案
     */
    private resolve_catalog_status_(health: ReturnType<typeof check_catalog_health>): {
        icon: string;
        icon_color?: vscode.ThemeColor;
        description: string;
        context_value: string;
    } {
        const context_parts = ['catalogEntry'];

        if (is_catalog_missing(health)) {
            context_parts.push('missing');
            return {
                icon: 'error',
                icon_color: new vscode.ThemeColor('errorForeground'),
                description: '\u7f3a\u5931',
                context_value: context_parts.join('.'),
            };
        }

        if (health.need_repair) {
            context_parts.push('needRepair');
            return {
                icon: 'warning',
                icon_color: new vscode.ThemeColor('editorWarning.foreground'),
                description: '\u5f85\u4fee\u590d',
                context_value: context_parts.join('.'),
            };
        }

        context_parts.push('ok');
        return {
            icon: 'pass-filled',
            icon_color: new vscode.ThemeColor('testing.iconPassed'),
            description: '\u6b63\u5e38',
            context_value: context_parts.join('.'),
        };
    }

    /**
     * 截断过长路径用于侧边栏展示
     */
    private shorten_path_(value: string): string {
        if (value.length <= 28) {
            return value;
        }
        return '...' + value.slice(-25);
    }
}

/**
 * 注册 CAA 侧边栏视图
 * @param context 扩展上下文
 */
export function register_caa_sidebar(
    context: vscode.ExtensionContext
): { provider: CaaSidebarProvider; tree_view: vscode.TreeView<CaaTreeItem> } {
    const provider = new CaaSidebarProvider();

    const tree_view = vscode.window.createTreeView('caaComposer.sidebar', {
        treeDataProvider: provider,
        showCollapseAll: true,
    });

    const refresh_command = vscode.commands.registerCommand('caa-composer.refreshSidebar', () => {
        provider.refresh(true);
    });
    const open_settings_command = vscode.commands.registerCommand('caa-composer.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'caaComposer');
    });
    const show_sidebar_command = vscode.commands.registerCommand('caa-composer.showSidebar', async () => {
        await vscode.commands.executeCommand('workbench.view.extension.caa-composer-sidebar');
    });

    context.subscriptions.push(
        tree_view,
        refresh_command,
        open_settings_command,
        show_sidebar_command
    );

    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh());
    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('caaComposer')) {
            provider.refresh();
        }
    });

    const cnext_graphic_watcher = vscode.workspace.createFileSystemWatcher(
        '**/CNext/resources/graphic/**'
    );
    const win_b64_graphic_watcher = vscode.workspace.createFileSystemWatcher(
        '**/win_b64/resources/graphic/**'
    );
    for (const watcher of [cnext_graphic_watcher, win_b64_graphic_watcher]) {
        watcher.onDidChange(() => provider.refresh());
        watcher.onDidCreate(() => provider.refresh());
        watcher.onDidDelete(() => provider.refresh());
        context.subscriptions.push(watcher);
    }

    return { provider, tree_view };
}
