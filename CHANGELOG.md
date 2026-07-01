# Change Log

All notable changes to the "caa-composer" extension will be documented in this file.

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
