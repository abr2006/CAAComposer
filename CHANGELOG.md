# Change Log

All notable changes to the "caa-composer" extension will be documented in this file.

## [0.0.15] - 2026-08-11

### Changed

- Build / Catalog bat: auto-detect RADE runtime dir (`win_b64` for 64-bit, fallback `intel_a`) under `radePath`
- TCK profile mapping: `R20` → `V5R20_B20`; `R26` → `V5_6R2016_B26`; also accepts full profile names; fallback reads `TCK/Install.txt`

## [0.0.14] - 2026-07-29

### Fixed

- Format subfolder list: include Windows `mklink /J` directory junctions (Dirent.isDirectory() is false for them)

## [0.0.13] - 2026-07-29

### Changed

- Add Marketplace `keywords` (`CAA Composer`, `caa composer`, `CATIA`, …) so space-separated search can find the extension

## [0.0.12] - 2026-07-28

### Changed

- Buildlink **Generate**: use `mklink /J` (directory junction) instead of `mklink /D`

## [0.0.11] - 2026-07-28

### Changed

- Buildlink **Open Git Repos**: open a probe file in each Target symlink's source folder only; no longer walks up looking for `.git` or uses the Git API
- Buildlink **Open Git Repos**: probe search recurses deeper into empty module roots (prefer text/`IdentityCard.h`, skip binaries like `.bmp`)

## [0.0.10] - 2026-07-27

### Changed

- Buildlink **Open Git Repos**: resolve Git root from each symlink real path, walking up at most 3 parent folders before opening a probe file

## [0.0.9] - 2026-07-27

### Changed

- Buildlink **Open Git Repos**: no longer adds multi-root workspace folders; briefly opens then closes a file under each Target symlink so Git repos appear in Source Control

## [0.0.8] - 2026-07-24

### Fixed

- Catalog health: skip `FeatureBackUpGeoElem3D` check for **GSMTool**-derived startups (avoids false "Needs repair")
- Catalog regenerate: copy CATfct from `C:\\temp` back to `graphic` after rebuild (fixes missing CATfct on GSMTool modules)
- Catalog regenerate/repair: skip `BackupStartUpTool` for GSMTool startups; repair shows an informational message instead

## [0.0.7] - 2026-07-24

### Added

- Buildlink Tool: **Open Git Repos** — scan Target directory symlinks, resolve unique Git roots, and add them as multi-root workspace folders

## [0.0.6] - 2026-07-20

### Added

- Format sidebar: check subfolders under the workspace root and format `.cpp` / `.h` in selected folders only

### Changed

- Format list UI: tighter row spacing and a slimmer scrollbar

## [0.0.5] - 2026-07-16

### Added

- Status bar shortcuts for **CAA Build** and **CAA Run** (shown after workspace `.vscode` setup exists)

### Changed

- Defer `.vscode` auto-setup from extension activate to first **Build** click (create only when missing)
- Sidebar tree: default expand **Build Actions** only; **Catalog** and **Configuration** collapsed
- **Buildlink Tool**, **ClearUp**, and **Format** views default to collapsed

## [0.0.4] - 2026-07-01

### Fixed

- Build / test run / Catalog batch when reusing an active terminal: fix Windows `cmd /c` quoting (resolves `'cd' is not recognized`)
- Applies to all actions that run `.caa-composer-run.bat` in the integrated terminal (including PowerShell as the active shell)

### Changed

- Centralize Windows cmd path quoting in `src/utils/windows_cmd.ts` (shared by build and Buildlink)
- Invoke workspace batch via `call` only; `.caa-composer-run.bat` already `cd`s to the workspace root

## [0.0.3] - 2026-06-30

### Fixed

- README Chinese text encoding (marketplace / Open VSX display)

## [0.0.2] - 2026-06-30

### Added

- CNEXT debug: auto-write `.vscode/launch.json`, attach debugger after test run
- Format sidebar: batch `clang-format` on all `.cpp` / `.h` with per-file log output
- Auto-setup `.clang-format`, `c_cpp_properties.json`, and workspace format settings on open

### Changed

- Format skips build output directories (`win_b64`, `intel_a`, `out`, `dist`, etc.)

## [0.0.1] - 2026-06-30

### Added

- CAA workspace build (mkmk), test run (mkrun cnext), and build artifact cleanup
- Catalog scan, health check, regenerate / update / repair actions
- Buildlink Tool sidebar (folder scan and `mklink /D` symlinks)
- ClearUp sidebar (empty all `win_b64` folder contents)
- Configurable Catalog naming rules (`caaComposer.catalog.*`)
- English and Simplified Chinese UI (VS Code display language)
