# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.1.0] - 2026-11-08

### Added
- **Dual Quota Limit Visibility (5h Burst & Weekly Limits)**:
  - Communicates directly with Antigravity's `RetrieveUserQuotaSummary` RPC to track both short-term 5-hour rolling limits and 1-week limits simultaneously.
  - Independent reset countdown timers for both 5h and weekly quotas.
- **Ultra-Compact Single-Line Chat HUD**:
  - Automatically identifies the active conversation model and displays a clean, single-line quota badge to avoid cluttering chat history.
  - Supports `--all` (or `AGQ_SHOW_ALL=1`) and `AGQ_HUD_FORMAT=table` for full overview tables when desired.
- **Response Footer Rule (`rules/AGENTS.md`)**:
  - Automatically appends the model quota HUD badge to the bottom of assistant responses without needing to open accordion UI.
- **Automated Release Skills & Workflows**:
  - Added `prepare-release` and `publish-release` skills and GitHub Actions CI workflow.

### Changed
- **CLI Command Unification**:
  - Unified the standalone executable command name to `agq-hud` to avoid future name collisions with official Antigravity tools.

### Fixed
- **Language Server Compatibility**:
  - Fixed metadata field serialization to prevent `language_server` scrubber crashes while ensuring HUD renders reliably in chat.
- **Plugin Rule Auto-Discovery**:
  - Renamed plugin rule to `rules/AGENTS.md` conforming to Antigravity's plugin discovery convention.

### Quality & Testing
- Integrated TypeScript-ESLint with strict code quality rules.
- Added comprehensive contract tests for hook payloads, CLI flags, package binary exports, and rule file conformance.

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
