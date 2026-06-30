# Change Log

All notable changes to the "caa-composer" extension will be documented in this file.

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
