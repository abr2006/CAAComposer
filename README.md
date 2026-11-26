# CAA Composer

VS Code / Cursor extension for CATIA CAA build, Catalog maintenance, Buildlink symlinks, and ClearUp cleanup.

CATIA CAA 项目编译、构建与 Catalog 运维的 VS Code / Cursor 扩展。

**[English](#english)** · **[中文](#中文)**
---

## English

Windows, with CATIA / RADE installed. Visual Studio, Cursor is recommended.

### 1. CAA BUILD

- **Build current workspace** — mkmk build this workspace. (**CAA Build** and **CAA Run** show up at the bottom right as shortcuts when the first time you use it.)
- **Test run** — run your win_b64
- **Remove build artifacts** — remove not publish files such like *.pdo, minimalize the`win_b64` output.
- **Catalog** — help manage your catalog **Regenerate**, **Update** or **Repair**. A missing catalog is red, one that needs repair is yellow, and a normal one is green.
- **Configuration** — open settings. **At least setting when fisrt time use：**

| Setting | What to fill |
| --- | --- |
| `caaComposer.radePath` | RADE root, e.g. `C:\DS\RADE20` |
| `caaComposer.catiaPath` | Libraries used when building. Several roots, separated by `;`. Example: `C:\DS\B20;E:\XYC\B20` |
| `caaComposer.version` | `R20`, `R26`, or a full TCK name such as `V5_6R2016_B26` |
| `caaComposer.runEnvironment` | Optional. Applied only when you **CAA Run**, add `set NAME=VALUE` |

### 2. BUILDLINK TOOL

This helps you mklink folder toghter. `mkmk` only builds CAA framework, so the better way is to mklink them together into current folder.

1. **Source**: the folder that holds the modules (`*.Frm`, `*.Interfaces`, `*.Tlb`).
2. **Target**: this workspace. The picker opens here.
3. **Fetch**, check the list, then **Generate**. That creates `mklink /J` junctions in Target. Editing a file there still edits the original repo.
4. **Open Git Repos** if you want those linked repos in Source Control.

### 3. CLEARUP

Finds every `win_b64` folder in the workspace and deletes the whole folder. The list shows what will be removed. **Clean Up** asks you to confirm first.

### 4. FORMAT

Formats C++ and header files with clang-format.

1. Check the workspace subfolders you want. `win_b64` is not in the list.
2. **Select all**, **Clear all**, or **Refresh** when you need them.
3. **Format selected C++/H**.

The first format writes `.clang-format` when that file is missing.
---

## 中文

需要 Windows，并已安装 CATIA / RADE。建议使用 Visual Studio、Cursor。

### 1. CAA BUILD

- **Build current workspace** — 用 mkmk 编译当前工作区。第一次使用后，右下角会出现 **CAA Build** 和 **CAA Run** 两个快捷命令。
- **Test run** — 运行你的 `win_b64`。
- **Remove build artifacts** — 删掉不发布的文件，例如 `*.pdo`，把 `win_b64` 输出收小。
- **Catalog** — 管理 Catalog，可 **Regenerate**、**Update** 或 **Repair**。缺失显示红色，需要修复显示黄色，正常显示绿色。
- **Configuration** — 打开设置。**第一次使用至少要填：**

| 项目 | 待补充内容 |
| --- | --- |
| `caaComposer.radePath` | RADE 根目录，例如 `C:\DS\RADE20` |
| `caaComposer.catiaPath` | 编译要引用的库。多个路径用 `;` 隔开，例如 `C:\DS\B20;E:\XYC\B20` |
| `caaComposer.version` | `R20`、`R26`，或完整 TCK，例如 `V5_6R2016_B26` |
| `caaComposer.runEnvironment` | 可选。只在 **CAA Run** 时生效，按 `set NAME=VALUE` 添加 |

### 2. BUILDLINK TOOL

把文件夹用 mklink 接到一起。`mkmk` 只编译 CAA framework，所以更好的办法是把它们链接到当前文件夹。

1. **Source**：放着模块的目录（`*.Frm`、`*.Interfaces`、`*.Tlb`）。
2. **Target**：当前工作区。选择框会打开在这里。
3. **Fetch**，核对列表，再 **Generate**。会在 Target 里创建 `mklink /J` 目录联接。在这里改文件，改的仍是原来的仓库。
4. 想在源代码管理里看到这些链接仓库时，点 **Open Git Repos**。

### 3. CLEARUP

找出工作区里每一个 `win_b64` 文件夹并整夹删除。列表里会显示将要删掉的内容。**Clean Up** 会先要求确认。

### 4. FORMAT

用 clang-format 格式化 C++ 和头文件。

1. 勾选要处理的工作区子文件夹。列表里没有 `win_b64`。
2. 需要时用 **Select all**、**Clear all** 或 **Refresh**。
3. **Format selected C++/H**。

第一次格式化时，如果还没有 `.clang-format`，会自动写上。

---

## License / 许可证

MIT. Copyright (c) 2026 M. Yan. See [LICENSE](LICENSE).
