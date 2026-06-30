# CAA Composer

VS Code / Cursor extension for CATIA CAA build, Catalog maintenance, Buildlink symlinks, and ClearUp cleanup.

CATIA CAA 项目编译、构建与 Catalog 运维的 VS Code / Cursor 扩展。

**[English](#english)** · **[中文](#中文)**

---

## English

After installation, click the **CAA Composer** icon in the activity bar to access build, Catalog, Buildlink, and ClearUp from the sidebar.

UI strings follow the VS Code / Cursor display language (`Configure Display Language`): English UI in English locales, Simplified Chinese in `zh-cn`.

### Requirements

- Windows (RADE / mklink require Windows)
- VS Code 1.85+ or Cursor
- Installed CATIA / RADE development environment
- Visual Studio recommended; enable **Use Developer Command Prompt** when possible

### Quick Start

#### 1. Open a CAA workspace

Open the CAA project root in VS Code / Cursor (contains `Imakefile.mk` or module `*Frm` folders).

#### 2. Configure RADE / CATIA

Open Settings (`Ctrl+,`), search **CAA Composer**, and set at minimum:

| Setting | Description | Example |
| --- | --- | --- |
| `caaComposer.radePath` | RADE install root | `C:\DS\RADE20` |
| `caaComposer.catiaPath` | CATIA install root | `C:\DS\B20` |
| `caaComposer.version` | CATIA/RADE version | `R20` (maps to `V5R20_B20`) |

#### 3. Sample `settings.json`

```json
{
  "caaComposer.radePath": "C:\\DS\\RADE20",
  "caaComposer.catiaPath": "C:\\DS\\B20",
  "caaComposer.version": "R20",
  "caaComposer.runMkRtv": true,
  "caaComposer.useDevEnvShell": true
}
```

#### 4. Build

Use sidebar **CAA Build → Build current workspace**, or Command Palette (`Ctrl+Shift+P`) → `CAA: Build Current Workspace`.

Build output goes to terminal **CAA Build**; detailed logs appear in output channel **CAA Composer**.

### Sidebar

| View | Description |
| --- | --- |
| **CAA Build** | Tree: build, test run, remove artifacts, Catalog list, config |
| **Buildlink Tool** | Scan folders and create `mklink /D` directory symlinks |
| **ClearUp** | Empty all `win_b64` folders in the workspace (keeps the folders) |

### Build Actions

**Build current workspace** — RADE script sequence at workspace root:

1. `tck_init.bat`
2. `tck_profile.bat` (profile from `caaComposer.version`)
3. `mkGetPreq.bat`
4. `mkmk.bat -au` (incremental workspace build)
5. `mkrtv.bat` (optional, controlled by `caaComposer.runMkRtv`)

**Test run** — `mkCreateRuntimeView.bat`, then `mkrun.bat -c "cnext"`.

**Remove build artifacts** — Targeted cleanup under workspace `win_b64` (not the same as ClearUp):

- `win_b64\code\bin`: `.exp`, `.lib`, `.exe`, `.pdb`
- Fixed folders: `control`, `code\lib`, `code\productIC`, `resources\msgcatalog\DbcsTest`, `resources\msgcatalog\NlsTest`, `resources\knowledge`

### Catalog Maintenance

The extension scans Catalog modules by configurable naming rules and lists health under **CAA Build → Catalog**.

| Status | Meaning |
| --- | --- |
| OK | CATfct and CATSpecs exist; CATfct contains `FeatureBackUpGeoElem3D` |
| Missing | CATfct or CATSpecs missing |
| Needs repair | CATfct exists but lacks `FeatureBackUpGeoElem3D` |

Inline actions: **Regenerate** / **Update** / **Repair**. Use the sidebar **Refresh** button to rescan.

Default naming targets the `XYC` prefix; customize via `caaComposer.catalog.*` settings.

### Buildlink Tool

1. Set **Source** and **Target**
2. Configure **Filter** (default `*.Frm,*.Interfaces,*.Tlb`) and **Ban** (default `PNX*`)
3. **Fetch** → right-click list for Clear / Copy → **Generate** symlinks

`mklink /D` requires Windows **Developer Mode** or running the IDE as Administrator.

### ClearUp

Finds every `win_b64` folder, removes all contents inside, and **keeps the `win_b64` folder**. Unlike **Remove build artifacts**, which only cleans fixed paths.

### Commands

| Command | Description |
| --- | --- |
| `CAA: Build Current Workspace` | Run mkmk build |
| `CAA: Test Run` | Launch cnext test |
| `CAA: Remove Build Artifacts` | Targeted win_b64 cleanup |
| `CAA: Open Buildlink Tool` | Focus Buildlink sidebar |
| `CAA: Open ClearUp` | Focus ClearUp sidebar |
| `CAA: Show Sidebar` | Open CAA Composer activity bar |

### Configuration Reference

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `caaComposer.radePath` | string | `""` | RADE install root |
| `caaComposer.catiaPath` | string | `""` | CATIA install root |
| `caaComposer.version` | string | `R20` | Version shorthand R19–R30 |
| `caaComposer.runMkRtv` | boolean | `true` | Run mkrtv after build |
| `caaComposer.useDevEnvShell` | boolean | `true` | Use VS Developer Command Prompt |
| `caaComposer.catalog.modulePrefix` | string | `XYC` | Catalog module prefix |
| `caaComposer.catalog.frmPattern` | string | `*.Frm` | Frm directory glob |
| `caaComposer.catalog.catalogPattern` | string | `*.Catalog.m` | Catalog directory glob |
| `caaComposer.catalog.catfctPattern` | string | `*.Feature.CATfct` | CATfct glob |
| `caaComposer.catalog.catspecsPattern` | string | `*.Feature.CATSpecs` | CATSpecs glob |

### Development & Packaging

```bash
npm install
npm run compile
```

Press `F5` to launch the Extension Development Host. Package VSIX:

```bash
npm install -g @vscode/vsce
npm run compile
vsce package
```

Install the generated `caa-composer-<version>.vsix` via **Extensions: Install from VSIX...**.

### FAQ

- **RADE / CATIA not configured** — Check `caaComposer.radePath`, `catiaPath`, `version`
- **RADE script not found** — Verify `intel_a\code\command\tck_init.bat` under `radePath`
- **Empty Catalog list** — Check `caaComposer.catalog.*` naming settings
- **Buildlink failures** — Usually `mklink` privilege issues
- **Remove artifacts vs ClearUp** — Former is targeted; latter empties all `win_b64` contents

### Project Layout

```
src/
├── extension.ts
├── config/          # Global & Catalog naming config
├── build/           # RADE build runner
├── catalog/         # Scan, health check, batch actions
├── tools/           # Buildlink & cleanup services
├── views/           # Sidebar & Webviews
├── commands/        # Command registration
└── i18n/            # Localization helpers & l10n bundles
```

---

## 中文

安装后点击活动栏 **CAA Composer** 图标，即可在侧边栏使用编译、Catalog 管理、Buildlink 软链接与 ClearUp 清理等功能。

界面语言跟随 VS Code / Cursor 显示语言（`Configure Display Language`）：英文环境显示英文，简体中文（`zh-cn`）显示中文。

### 环境要求

- Windows（RADE / mklink 等能力依赖 Windows）
- VS Code 1.85+ 或 Cursor
- 已安装 CATIA / RADE 开发环境
- 建议安装 Visual Studio 并启用「使用开发者命令行环境」

### 快速开始

#### 1. 打开 CAA 工作区

用 VS Code / Cursor 打开 CAA 工程根目录（含 `Imakefile.mk` 或各模块 `*Frm` 的目录）。

#### 2. 配置 RADE / CATIA

`Ctrl+,` 打开设置，搜索 **CAA Composer**，至少填写：

| 设置项 | 说明 | 示例 |
| --- | --- | --- |
| `caaComposer.radePath` | RADE 安装根目录 | `C:\DS\RADE20` |
| `caaComposer.catiaPath` | CATIA 安装根目录 | `C:\DS\B20` |
| `caaComposer.version` | CATIA/RADE 版本 | `R20`（自动映射为 `V5R20_B20`） |

#### 3. 示例 `settings.json`

```json
{
  "caaComposer.radePath": "C:\\DS\\RADE20",
  "caaComposer.catiaPath": "C:\\DS\\B20",
  "caaComposer.version": "R20",
  "caaComposer.runMkRtv": true,
  "caaComposer.useDevEnvShell": true
}
```

#### 4. 开始编译

侧边栏 **CAA 构建 → 编译当前工作区**，或命令面板（`Ctrl+Shift+P`）搜索 `CAA: 编译当前工作区`。

编译日志输出到终端 **CAA Build**，详细步骤见输出面板 **CAA Composer**。

### 侧边栏结构

| 视图 | 说明 |
| --- | --- |
| **CAA 构建** | 树形菜单：编译、测试运行、删除构建产物、Catalog 列表、当前配置 |
| **Buildlink Tool** | 扫描模块目录并批量创建 `mklink /D` 目录软链接 |
| **ClearUp** | 清空工作区内所有 `win_b64` 目录内容（保留目录本身） |

### 构建操作

**编译当前工作区** — 在工作区根目录执行 RADE 脚本序列：

1. `tck_init.bat`
2. `tck_profile.bat`（按 `caaComposer.version` 组合 Profile）
3. `mkGetPreq.bat`
4. `mkmk.bat -au`（全工作区增量编译）
5. `mkrtv.bat`（可选，由 `caaComposer.runMkRtv` 控制）

**测试运行** — 执行 `mkCreateRuntimeView.bat` 后运行 `mkrun.bat -c "cnext"`。

**删除构建产物** — 定点清理工作区根下 `win_b64` 中的部分构建产物（与 ClearUp 不同）：

- `win_b64\code\bin` 下的 `.exp`、`.lib`、`.exe`、`.pdb`
- 固定目录：`control`、`code\lib`、`code\productIC`、`resources\msgcatalog\DbcsTest`、`resources\msgcatalog\NlsTest`、`resources\knowledge`

### Catalog 运维

扩展会按命名规则扫描工作区中的 Catalog 模块，并在 **CAA 构建 → Catalog** 下列出健康状态。

| 状态 | 含义 |
| --- | --- |
| 正常 | CATfct / CATSpecs 均存在，且 CATfct 含 `FeatureBackUpGeoElem3D` |
| 缺失 | 缺少 CATfct 或 CATSpecs |
| 待修复 | CATfct 存在但缺少 `FeatureBackUpGeoElem3D` |

行内操作：**重新生成** / **更新** / **修复**。点击侧边栏标题栏 **刷新** 可重新扫描。

Catalog 命名默认可适配 `XYC` 前缀，可通过 `caaComposer.catalog.*` 设置项定制。

### Buildlink Tool

1. 填写 **Source** 与 **Target**
2. 设置 **Filter**（默认 `*.Frm,*.Interfaces,*.Tlb`）和 **Ban**（默认 `PNX*`）
3. **Fetch** 扫描 → 列表右键 Clear / Copy → **Generate** 生成软链接

`mklink /D` 需开启 Windows **开发人员模式**，或以管理员身份运行 IDE。

### ClearUp

递归查找每一个 `win_b64`，删除其内部全部内容，**保留 `win_b64` 目录本身**。与「删除构建产物」不同。

### 命令列表

| 命令 | 说明 |
| --- | --- |
| `CAA: 编译当前工作区` | 执行 mkmk 编译 |
| `CAA: 测试运行` | 启动 cnext 测试 |
| `CAA: 删除构建产物` | 定点清理 win_b64 构建产物 |
| `CAA: 打开 Buildlink Tool` | 聚焦 Buildlink 侧边栏 |
| `CAA: 打开 ClearUp` | 聚焦 ClearUp 侧边栏 |
| `CAA: 显示侧边栏` | 打开 CAA Composer 活动栏 |

### 开发与打包

```bash
npm install
npm run compile
```

按 `F5` 启动扩展开发宿主。打包 VSIX：

```bash
npm install -g @vscode/vsce
npm run compile
vsce package
```

### 常见问题

- **未配置 RADE / CATIA** — 检查 `caaComposer.radePath`、`catiaPath`、`version`
- **找不到 RADE 脚本** — 确认 `intel_a\code\command\tck_init.bat` 存在
- **Catalog 列表为空** — 检查 `caaComposer.catalog.*` 命名配置
- **Buildlink 全部失败** — 多为 `mklink` 权限不足
- **删除构建产物 vs ClearUp** — 前者定点清理；后者清空所有 `win_b64` 内容

---

## License / 许可证

This project is licensed under the **MIT License**.

Copyright (c) 2026 M. Yan

See [LICENSE](LICENSE) for the full text.

本项目采用 **MIT 许可证** 授权。完整条款见 [LICENSE](LICENSE) 文件。
