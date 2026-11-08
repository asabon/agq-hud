# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.0.1] - 2026-11-08

### Added
- **Initial release of official Antigravity 2.0 / CLI / IDE plugin**:
  - Full compliance with `plugin.json` and `hooks.json` specifications.
- **Zero-token inline chat HUD (`PreInvocation` hook)**:
  - Graphical quota gauge display (`████████░░`) rendered via `metadata.user_markdown`.
  - Zero prompt token overhead with `systemMessage: ""` (zero token consumption).
  - Automatic active model highlighting with target emoji (🎯).
- **Standalone CLI tool (`agq` / `agq-hud`)**:
  - Real-time remaining quota and reset countdown table in terminal.
  - `-v` / `--verbose`: Detailed breakdown including Low / Medium / High model variants.
  - `--json`: Machine-readable JSON output for scripting and tooling.
  - `-V` / `--version`: Version information.
- **Zero external runtime dependencies & fast startup**:
  - Bundled into a standalone executable (`bin/agq.cjs`) using `esbuild`.
  - Runs in milliseconds on standard Node.js without npm dependency bloat.
- **Cross-platform auto-discovery**:
  - Auto-detection of environment variables (`ANTIGRAVITY_LS_ADDRESS`, `ANTIGRAVITY_CSRF_TOKEN`).
  - Automatic detection of running `language_server` processes and listening ports across Windows, macOS, and Linux.
