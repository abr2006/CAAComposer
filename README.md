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
| `caaComposer.catiaPath` | CATIA paths for mkGetPreq; separate multiple paths with `;` | `C:\DS\B20;E:\XyRoot\xy\XYC\B20` |
| `caaComposer.version` | CATIA/RADE level / TCK | `R20` → `V5R20_B20`; `R26` → `V5_6R2016_B26` (or paste full TCK) |
| `caaComposer.runEnvironment` | Extra `set` variables for **Test Run** only. Left is the name, right is the value | `XXX` = `X:\XXX` |

`caaComposer.catiaPath` is the prerequisite list passed to `mkGetPreq -p` when you build. It is **not** the list of source modules. Put the official CATIA root and any extra framework roots on one line, separated by a semicolon:

`C:\DS\B20;E:\XyRoot\xy\XYC\B20`

`caaComposer.runEnvironment` is a name/value table. Add a variable name on the left and its value on the right (`name = value`). On **Test Run**, the extension runs `set "NAME=VALUE"` before `mkrun`. These variables are not applied to `mkmk`.

Source modules from other Git repositories are brought into this workspace with **Buildlink** (see [Daily CAA build](#daily-caa-build-one-workspace-for-many-projects)).

#### 3. Sample `settings.json`

```json
{
  "caaComposer.radePath": "C:\\DS\\RADE20",
  "caaComposer.catiaPath": "C:\\DS\\B20;E:\\XyRoot\\xy\\XYC\\B20",
  "caaComposer.version": "R20",
  "caaComposer.runMkRtv": true,
  "caaComposer.useDevEnvShell": true,
  "caaComposer.runEnvironment": {
    "XXX": "X:\\XXX"
  }
}
```

#### 4. Build

Use sidebar **CAA Build → Build current workspace**, or Command Palette (`Ctrl+Shift+P`) → `CAA: Build Current Workspace`.

Build output goes to terminal **CAA Build**; detailed logs appear in output channel **CAA Composer**.

### Sidebar

| View | Description |
| --- | --- |
| **CAA Build** | Tree: build, test run, remove artifacts, Catalog list, config |
| **Buildlink Tool** | Scan folders and create `mklink /J` directory junctions |
| **ClearUp** | Delete all `win_b64` folders in the workspace |

### Build Actions

**Build current workspace** — RADE script sequence at workspace root:

1. `tck_init.bat`
2. `tck_profile.bat` (profile from `caaComposer.version`)
3. `mkGetPreq.bat`
4. `mkmk.bat -au` (incremental workspace build)
5. `mkrtv.bat` (optional, controlled by `caaComposer.runMkRtv`)

**Test run** — `mkCreateRuntimeView.bat`, then each `caaComposer.runEnvironment` entry as `set "NAME=VALUE"`, then `mkrun.bat -c "cnext"`.

**Remove build artifacts** — Targeted cleanup under workspace `win_b64` (not the same as ClearUp):

- `win_b64\code\bin`: `.exp`, `.lib`, `.exe`, `.pdb`
- Fixed folders: `control`, `code\lib`, `code\productIC`, `resources\msgcatalog\DbcsTest`, `resources\msgcatalog\NlsTest`, `resources\knowledge`

### Daily CAA build: one workspace for many projects

CAA C++ modules usually live in separate Git repositories. `mkmk` only builds what it can see under the **current workspace**. You do not need to copy those trees together. Buildlink creates directory junctions so the modules you need show up as folders in one workspace, while edits still go to the original repository.

1. **Open a build workspace.** Create or open a folder such as `E:\XYCAutoBuild`. This folder is the Buildlink **Target**.
2. **Tell the compiler which libraries to use.** Set `caaComposer.catiaPath` to every prerequisite root, separated by `;`. Example: official CATIA plus your own framework install. `mkGetPreq` receives that whole string. Do not list `*.Frm` modules here.
3. **Junction the modules into the workspace** (sidebar **Buildlink Tool**):
   - **Source** — parent folder that contains the repositories or frameworks (`*.Frm`, `*.Interfaces`, `*.Tlb` live underneath).
   - **Target** — the workspace you opened. The folder picker starts in the current workspace.
   - **Filter** — default `*.Frm,*.Interfaces,*.Tlb`. The restore button puts this text back.
   - **Ban** — default `PNX*`. Matching names are skipped.
   - **Search subfolders** — on by default, so Fetch walks the whole Source tree. Turn it off to look only at Source's immediate children.
   - **Fetch**, review the list (right-click Clear / Copy), then **Generate**.
4. **What Generate does.** For each listed folder it runs `mklink /J`, for example `E:\XYCAutoBuild\XyFoo.Frm` → the real folder under Source. Opening a `.cpp` through that junction edits the file in the original Git repo. **Open Git Repos** briefly opens a probe file in each linked source folder so those repositories show up in Source Control.
5. **Build.** **Build current workspace** runs `tck_init` → `tck_profile` → `mkGetPreq` (the semicolon-separated paths) → `mkmk -au`, then optional `mkrtv`.
6. **Run.** **Test Run** starts CNEXT. Add runtime variables under `caaComposer.runEnvironment`: the left column is the name and the right column is the value (`XXX` = `X:\XXX` becomes `set "XXX=X:\XXX"` immediately before `mkrun`).

Target should be a local NTFS folder. `mklink /J` usually does not need Administrator rights. If a real folder already occupies a name, Generate will not delete it.

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

Use this to assemble modules before a daily build. The full sequence is in [Daily CAA build](#daily-caa-build-one-workspace-for-many-projects).

1. Set **Source** and **Target** (Target defaults to the current workspace)
2. Configure **Filter** (default `*.Frm,*.Interfaces,*.Tlb`) and **Ban** (default `PNX*`)
3. Leave **Search subfolders** checked to walk Source recursively; uncheck it to scan only Source's first level
4. **Fetch** → right-click list for Clear / Copy → **Generate** junctions
5. **Open Git Repos** — briefly open (then close) a probe file in each Target symlink's **source folder** so Git repos appear in **Source Control** (does not walk up for `.git`, does not add workspace folders)

`mklink /J` creates directory junctions (usually no Administrator / Developer Mode required; Target should be on a local NTFS drive).

### ClearUp

Finds every `win_b64` folder and **deletes the folder itself**. Unlike **Remove build artifacts**, which only cleans targeted paths under root `win_b64`.

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
| `caaComposer.catiaPath` | string | `""` | CATIA paths for build; `;` separates multiple paths |
| `caaComposer.version` | string | `R20` | Level `Rn` or full TCK (`V5R20_B20` / `V5_6R2016_B26`) |
| `caaComposer.runMkRtv` | boolean | `true` | Run mkrtv after build |
| `caaComposer.useDevEnvShell` | boolean | `true` | Use VS Developer Command Prompt |
| `caaComposer.runEnvironment` | object | `{}` | Name = value pairs applied as `set` before CAA test run |
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
- **RADE script not found** — Verify `win_b64\code\command\tck_init.bat` or `intel_a\code\command\tck_init.bat` under `radePath` (auto-detected)
- **Empty Catalog list** — Check `caaComposer.catalog.*` naming settings
- **Buildlink failures** — Usually `mklink` privilege issues
- **Remove artifacts vs ClearUp** — Former cleans targeted root `win_b64` paths; latter deletes all `win_b64` folders

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
| `caaComposer.catiaPath` | 参与编译的 CATIA 路径，多个用 `;` 隔开 | `C:\DS\B20;E:\XyRoot\xy\XYC\B20` |
| `caaComposer.version` | CATIA/RADE 版本 / TCK | `R20` → `V5R20_B20`；`R26` → `V5_6R2016_B26`（也可直接填完整 TCK） |
| `caaComposer.runEnvironment` | 仅 **测试运行** 时附加的 `set` 变量。左边是变量名，右边是值 | `XXX` = `X:\XXX` |

`caaComposer.catiaPath` 是编译时交给 `mkGetPreq -p` 的前置路径，**不是**源码模块列表。官方 CATIA 和自有框架写在同一行，用英文分号隔开：

`C:\DS\B20;E:\XyRoot\xy\XYC\B20`

`caaComposer.runEnvironment` 是变量名和值的对照表。添加时左边填变量名，右边填值（`变量名 = 值`）。**测试运行** 时，会在 `mkrun` 之前执行 `set "变量名=值"`。这些变量不会加到 `mkmk` 编译里。

散落在其他 Git 仓库里的源码模块，用 **Buildlink** 接到当前工作区（见 [日常编译](#日常编译用-buildlink-把多个项目放到一起)）。

#### 3. 示例 `settings.json`

```json
{
  "caaComposer.radePath": "C:\\DS\\RADE20",
  "caaComposer.catiaPath": "C:\\DS\\B20;E:\\XyRoot\\xy\\XYC\\B20",
  "caaComposer.version": "R20",
  "caaComposer.runMkRtv": true,
  "caaComposer.useDevEnvShell": true,
  "caaComposer.runEnvironment": {
    "XXX": "X:\\XXX"
  }
}
```

#### 4. 开始编译

侧边栏 **CAA 构建 → 编译当前工作区**，或命令面板（`Ctrl+Shift+P`）搜索 `CAA: 编译当前工作区`。

编译日志输出到终端 **CAA Build**，详细步骤见输出面板 **CAA Composer**。

### 侧边栏结构

| 视图 | 说明 |
| --- | --- |
| **CAA 构建** | 树形菜单：编译、测试运行、删除构建产物、Catalog 列表、当前配置 |
| **Buildlink Tool** | 扫描模块目录并批量创建 `mklink /J` 目录联接 |
| **ClearUp** | 删除工作区内所有 `win_b64` 文件夹 |

### 构建操作

**编译当前工作区** — 在工作区根目录执行 RADE 脚本序列：

1. `tck_init.bat`
2. `tck_profile.bat`（按 `caaComposer.version` 组合 Profile）
3. `mkGetPreq.bat`
4. `mkmk.bat -au`（全工作区增量编译）
5. `mkrtv.bat`（可选，由 `caaComposer.runMkRtv` 控制）

**测试运行** — 执行 `mkCreateRuntimeView.bat`，再按 `caaComposer.runEnvironment` 逐条 `set "NAME=VALUE"`，然后运行 `mkrun.bat -c "cnext"`。

**删除构建产物** — 定点清理工作区根下 `win_b64` 中的部分构建产物（与 ClearUp 不同）：

- `win_b64\code\bin` 下的 `.exp`、`.lib`、`.exe`、`.pdb`
- 固定目录：`control`、`code\lib`、`code\productIC`、`resources\msgcatalog\DbcsTest`、`resources\msgcatalog\NlsTest`、`resources\knowledge`

### 日常编译：用 Buildlink 把多个项目放到一起

CAA 的 C++ 模块通常在不同的 Git 仓库里。`mkmk` 只编译**当前工作区**下面能看见的工程。不必把这些目录复制到一处：用 Buildlink 做目录联接，需要的模块就会出现在同一个工作区里，改文件仍然改的是原来的仓库。

1. **打开一个编译工作区。** 新建或打开例如 `E:\XYCAutoBuild` 这样的目录。它就是 Buildlink 的 **Target**。
2. **告诉编译器要引用哪些库。** `caaComposer.catiaPath` 里写下所有前置根目录，用 `;` 隔开。例如官方 CATIA 再加自己的框架安装目录。整段字符串会传给 `mkGetPreq`。`*.Frm` 模块不要写在这里。
3. **把模块接到工作区里**（侧边栏 **Buildlink Tool**）：
   - **Source** — 各仓库或框架的上级目录（下面有 `*.Frm`、`*.Interfaces`、`*.Tlb`）。
   - **Target** — 刚打开的工作区。点「…」时对话框默认停在当前工作区。
   - **Filter** — 默认 `*.Frm,*.Interfaces,*.Tlb`，旁边的恢复按钮可以还原这段文本。
   - **Ban** — 默认 `PNX*`，命中的名字会跳过。
   - **遍历子文件夹** — 默认勾选，Fetch 会递归整个 Source；取消后只看 Source 的直接子文件夹。
   - **Fetch** 看列表（右键 Clear / Copy），确认后 **Generate**。
4. **Generate 做了什么。** 对列表中的每个目录执行 `mklink /J`，例如 `E:\XYCAutoBuild\XyFoo.Frm` 指向 Source 里的真实文件夹。从联接打开 `.cpp` 改的是原 Git 仓库里的文件。需要源代码管理看到这些仓库时，点 **打开 Git 仓库**。
5. **编译。** **编译当前工作区** 依次执行 `tck_init` → `tck_profile` → `mkGetPreq`（使用上面用分号隔开的路径）→ `mkmk -au`，可选 `mkrtv`。
6. **运行。** **测试运行** 启动 CNEXT。运行时要带的变量填在 `caaComposer.runEnvironment`：左边是变量名，右边是值。例如 `XXX` = `X:\XXX`，会在 `mkrun` 前变成 `set "XXX=X:\XXX"`。

Target 放在本地 NTFS 盘上。`mklink /J` 通常不需要管理员权限。如果某个名字已经被真实文件夹占用，Generate 不会删掉它。

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

日常把多个仓库收进同一个工作区再编译，步骤见 [日常编译](#日常编译用-buildlink-把多个项目放到一起)。

1. 填写 **Source** 与 **Target**（Target 打开时默认为当前工作区）
2. 设置 **Filter**（默认 `*.Frm,*.Interfaces,*.Tlb`）和 **Ban**（默认 `PNX*`）
3. **遍历子文件夹** 默认勾选，会递归 Source；取消则只扫描 Source 第一层
4. **Fetch** 扫描 → 列表右键 Clear / Copy → **Generate** 生成目录联接
5. **打开 Git 仓库** — 短暂打开并关闭各 Target 软链接**源文件夹**内的探针文件，使所属仓库出现在 **源代码管理** 中（不再向上查找 `.git`，不会添加工作区文件夹）

`mklink /J` 创建目录联接（通常无需管理员/开发人员模式；Target 建议在本地 NTFS 磁盘上）。

### ClearUp

递归查找每一个 `win_b64` 文件夹并**整目录删除**。与「删除构建产物」不同。

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
- **找不到 RADE 脚本** — 确认 `radePath` 下存在 `win_b64\code\command\tck_init.bat` 或 `intel_a\code\command\tck_init.bat`（自动检测）
- **Catalog 列表为空** — 检查 `caaComposer.catalog.*` 命名配置
- **Buildlink 全部失败** — 多为 `mklink` 权限不足
- **删除构建产物 vs ClearUp** — 前者定点清理根目录 `win_b64`；后者删除所有 `win_b64` 文件夹

---

## License / 许可证

This project is licensed under the **MIT License**.

Copyright (c) 2026 M. Yan

See [LICENSE](LICENSE) for the full text.

本项目采用 **MIT 许可证** 授权。完整条款见 [LICENSE](LICENSE) 文件。
