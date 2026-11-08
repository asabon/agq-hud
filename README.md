# AGQ HUD (`agq-hud`)

[![Antigravity Plugin](https://img.shields.io/badge/Antigravity-Plugin-blue)](https://antigravity.google)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2022-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**English** | [日本語](README.ja.md)

A lightweight Antigravity plugin and standalone CLI tool that displays real-time **AI model quota gauges and reset countdowns** (for Gemini, Claude, GPT-OSS, and more) inline in your chat turns and terminal for Antigravity 2.0, CLI, and IDE.

---

## ✨ Key Features

1. **Zero-Token Overhead Inline Chat HUD (Hook & Rule Mode)**
   - Utilizes Antigravity's `PreInvocation` lifecycle hook to inject real-time quota information into the turn.
   - Bundles a built-in agent rule (`rules/quota-hud.md`) to automatically append the quota HUD banner directly to the footer of every assistant response, glanceable without expanding accordions.
   - **Dual Limit Visibility (5h & Weekly)**: Communicates with Antigravity's `RetrieveUserQuotaSummary` RPC to track both short-term 5-hour burst limits and full 1-week limits.
   - **Ultra-compact single-line HUD**: By default, displays only the currently active conversation model as an unobtrusive single-line status banner.
   - Fallback / customizable: Automatically falls back to full table view if the active model cannot be detected, or when `--all` / `AGQ_SHOW_ALL=1` is configured.

2. **Standalone Terminal CLI (`agq-hud`)**
   - Run `agq-hud` from any terminal or PowerShell window to view 5-hour and weekly quota gauges and reset timers.
   - `agq-hud [filter]`: Filter quota display by model name or family (e.g. `agq-hud flash`, `agq-hud claude`).
   - `-v` / `--verbose`: Displays detailed breakdown of all sub-variants (Low, Medium, High).
   - `--json`: Outputs machine-readable JSON for custom status bars, prompt integrations, or scripts.

3. **Zero External Dependencies & Instant Startup**
   - Pre-bundled into a single executable file (`bin/agq.cjs`) using `esbuild`.
   - Built purely on standard Node.js runtime APIs without runtime npm dependencies. Starts up in milliseconds.

4. **Cross-Platform Auto-Discovery**
   - Automatically detects Antigravity environment variables (`ANTIGRAVITY_LS_ADDRESS`, `ANTIGRAVITY_CSRF_TOKEN`).
   - Seamlessly searches and discovers running `language_server` background processes and listening ports across Windows, macOS, and Linux when invoked standalone.

---

## 📦 Installation

### 1. One-Liner via `agy` CLI

```bash
agy plugin install https://github.com/asabon/agq-hud
```

### 2. Manual Installation

Clone directly into your Antigravity plugins directory:

```bash
# Windows
git clone https://github.com/asabon/agq-hud.git %USERPROFILE%\.gemini\config\plugins\agq-hud

# macOS / Linux
git clone https://github.com/asabon/agq-hud.git ~/.gemini/config/plugins/agq-hud
```

Once installed, the Quota HUD will automatically appear at the top of your chat turns starting with your next interaction.

---

## 🚀 Usage

### 1. Hook Mode (Automatic Chat HUD)

When enabled, the `PreInvocation` hook defined in `hooks.json` triggers before each model invocation and renders an unobtrusive inline Markdown HUD in the Antigravity chat:

> 📊 **Gemini 3.8 Flash** &nbsp;·&nbsp; 5h: `64.5%` 🟢 (3m) &nbsp;·&nbsp; 1w: `75.5%` 🟢 (5d 16h) &nbsp;·&nbsp; `Google AI Pro`

*(Note: To show the full table with all models, run with `--all` or set `AGQ_SHOW_ALL=1`. To force table layout for single model, set `AGQ_HUD_FORMAT=table`.)*

---

### 2. CLI Mode (`agq-hud`)

Inspect quotas anytime directly from your terminal:

```bash
# Show summary table for all models
agq-hud

# Filter by model name or family
agq-hud flash
agq-hud claude

# Show detailed breakdown for all model tiers/variants
agq-hud -v

# Output raw JSON
agq-hud --json

# Print version
agq-hud --version
```

#### CLI Output Example:

```text
⚡ AGQ HUD — Model Quota Monitor
Tier: Google AI Pro (user@example.com)

────────────────────────────────────────────────────────────────────────────────
 Model              5h Limit      Weekly Limit  Reset (5h)    Reset (1w)    
────────────────────────────────────────────────────────────────────────────────
 Gemini 4 Argon     -             12.7% ⚠️      -             5d 16h        
 Gemini 3.8 Flash   64.5% 🟢      75.5% 🟢      3m            5d 16h        
 Claude Opus 5.5    100.0% 🟢     32.9% 🟡      4h 56m        5d 16h        
 Claude Sonnet 5.5  100.0% 🟢     32.9% 🟡      4h 56m        5d 16h        
 GPT-OSS 120B       100.0% 🟢     32.9% 🟡      4h 56m        5d 16h        
────────────────────────────────────────────────────────────────────────────────
Tip: Run with -v or --verbose to view all model sub-variants.
```

---

## 🛠️ Project Structure

```text
agq-hud/
├── plugin.json         # Antigravity plugin manifest
├── hooks.json          # PreInvocation lifecycle hook configuration
├── package.json        # Build scripts and project metadata
├── tsconfig.json       # TypeScript compiler configuration
├── bin/
│   └── agq.cjs         # Pre-bundled standalone executable
├── src/
│   ├── index.ts        # CLI & Hook entrypoint
│   ├── types.ts        # Type definitions & interfaces
│   ├── detector.ts     # Cross-platform process/port discovery
│   ├── client.ts       # Language Server RPC client
│   └── formatter.ts    # Markdown HUD & CLI table formatters
└── README.md           # Documentation
```

---

## 🔧 Development & Building

```bash
# Install development dependencies
npm install

# Run TypeScript type check
npm run typecheck

# Build bundle (generates bin/agq.cjs)
npm run build
```

---

## 📄 License

MIT License
