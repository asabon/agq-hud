# AGQ HUD (`agq-hud`)

[![Antigravity Plugin](https://img.shields.io/badge/Antigravity-Plugin-blue)](https://antigravity.google)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2022-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) | **日本語**

Antigravity 2.0 / CLI / IDE 向けに、各 AI モデル（Gemini, Claude, GPT-OSS 等）の **Quota（残量メーター・リセット時間）** を毎ターンチャット画面上にインライン表示する公式仕様の Antigravity プラグイン & CLI ツールです。

---

## ✨ 主な特長

1. **チャット内常時表示 HUD (Hook & Rule モード)**
   - Antigravity の `PreInvocation` ライフサイクルフックと同梱エージェントルール（`rules/AGENTS.md`）により、アシスタントの返答フッターにリアルタイムクォータ情報を自動付与。
   - アコーディオンを開く必要がなく、常に一目で残量と次回リセット時間を確認可能。
   - **5h 制限と 1w 制限のデュアル表示**: `RetrieveUserQuotaSummary` RPC と連携し、直近の 5時間バースト制限（5h）と 1週間制限（Weekly / 1w）の両方を高精度に取得・表示。
   - **超コンパクトな1行表示**: デフォルトでは現在会話で選択中のモデルのみを1行ステータスバナーとして表示し、会話の邪魔になりません。
   - フォールバック & カスタマイズ対応: 選択中のモデルが未検出の場合は自動で全モデルテーブルにフォールバック。`--all` または環境変数 `AGQ_SHOW_ALL=1` で全モデル表示、`AGQ_HUD_FORMAT=table` でテーブル表示にも切り替え可能。

2. **ターミナルから手軽に確認できる CLI モード (`agq-hud`)**
   - いつでもターミナルから `agq-hud` と叩くだけで、各モデルの 5時間制限 / 週間制限と次回リセットまでのカウントダウンをテーブル表示。
   - `agq-hud [フィルター]`: モデル名やファミリー名で絞り込み表示（例: `agq-hud flash`, `agq-hud claude`）。
   - `-v` / `--verbose` で低・中・高バリアント（Low / Medium / High）の詳細一覧を表示。
   - `--json` で外部スクリプト連携用の JSON 出力に対応。

3. **ゼロ依存 & 超高速起動**
   - `esbuild` により全ロジックを単一ファイル (`bin/agq.cjs`) にバンドル。
   - 外部 npm パッケージに依存せず、Node.js 標準ライブラリのみで数ミリ秒で起動。

4. **マルチプラットフォーム対応の自動プロセス探索**
   - 環境変数（`ANTIGRAVITY_LS_ADDRESS`, `ANTIGRAVITY_CSRF_TOKEN`）を自動検知。
   - ターミナル単体起動時でも、バックグラウンドで動作している Antigravity 2.0 (`language_server.exe` / `agy`) を Windows / macOS / Linux から自動探索・ポート検出。

---

## 📦 インストール方法

### 1. `agy` コマンドでワンライナー導入

```bash
agy plugin install https://github.com/asabon/agq-hud
```

または、ローカルのプラグインディレクトリに配置するだけで即座に自動認識されます。

```bash
# Windows
git clone https://github.com/asabon/agq-hud.git %USERPROFILE%\.gemini\config\plugins\agq-hud

# macOS / Linux
git clone https://github.com/asabon/agq-hud.git ~/.gemini/config/plugins/agq-hud
```

インストール後、次回の会話ターンから自動的にチャット画面上に Quota HUD が表示されます。

---

## 🚀 使い方

### 1. Hook モード (チャット画面自動表示)

プラグインを有効化すると、ユーザーの発言ごとに `hooks.json` の `PreInvocation` フックが自動実行され、会話の邪魔にならないコンパクトなインライン HUD がチャット上部にレンダリングされます：

> 📊 **Gemini 3.8 Flash** &nbsp;·&nbsp; 5h: `64.5%` 🟢 (3m) &nbsp;·&nbsp; 1w: `75.5%` 🟢 (5d 16h) &nbsp;·&nbsp; `Google AI Pro`

*(※全モデルを一覧表示したい場合は `--all` や環境変数 `AGQ_SHOW_ALL=1` を指定できます。単一モデルでもテーブル形式にしたい場合は `AGQ_HUD_FORMAT=table` を指定できます)*

---

### 2. CLI モード (`agq-hud`)

ターミナルや PowerShell から直接実行できます：

```bash
# 全モデルのサマリー表示
agq-hud

# モデル名やファミリー名で絞り込み
agq-hud flash
agq-hud claude

# 詳細一覧（Low / Medium / High 全モデル）
agq-hud -v

# JSON 形式で出力
agq-hud --json

# バージョン確認
agq-hud --version
```

#### CLI 出力例:

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

## 🛠️ プロジェクト構成

```text
agq-hud/
├── plugin.json         # Antigravity 公式プラグインマニフェスト
├── hooks.json          # PreInvocation ライフサイクルフック定義
├── package.json        # ビルドスクリプト & 依存関係設定
├── tsconfig.json       # TypeScript コンパイラ設定
├── bin/
│   └── agq.cjs         # バンドル済み単一実行ファイル（配布用）
├── src/
│   ├── index.ts        # CLI / Hook エントリポイント
│   ├── types.ts        # データ型・インターフェース定義
│   ├── detector.ts     # マルチプラットフォーム プロセス/ポート自動探索
│   ├── client.ts       # Language Server RPC クライアント
│   └── formatter.ts    # Markdown HUD & CLI テーブルフォーマッタ
└── README.md           # 本ドキュメント
```

---

## 🔧 開発とビルド

```bash
# 依存パッケージのインストール
npm install

# TypeScript 型チェック
npm run typecheck

# バンドル (bin/agq.cjs 生成)
npm run build
```

---

## 📄 ライセンス

MIT License
