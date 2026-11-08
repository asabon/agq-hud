# AGQ HUD (`agq-hud`)

[![Antigravity Plugin](https://img.shields.io/badge/Antigravity-Plugin-blue)](https://antigravity.google)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2022-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Antigravity 2.0 / CLI / IDE 向けに、各 AI モデル（Gemini, Claude, GPT-OSS 等）の **Quota（残量メーター・リセット時間）** を毎ターンチャット画面上にインライン表示する公式仕様の Antigravity プラグイン & CLI ツールです。

---

## ✨ 主な特長

1. **トークン消費ゼロのインラインチャット HUD (Hook モード)**
   - Antigravity の `PreInvocation` ライフサイクルフックを活用し、チャット画面上に `metadata.user_markdown` 形式で残量メーターを表示。
   - モデルへのプロンプト入力トークンは一切消費しません（`systemMessage: ""` による完全ゼロオーバーヘッド）。
   - 現在会話中のアクティブモデルに自動でターゲットマーク（🎯）を付与。

2. **ターミナルから手軽に確認できる CLI モード (`agq` / `agq-hud`)**
   - いつでもターミナルから `agq` と叩くだけで、各モデルの残量バーと次回リセットまでのカウントダウンをテーブル表示。
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

プラグインを有効化すると、ユーザーの発言ごとに `hooks.json` の `PreInvocation` フックが自動実行され、以下のようなインライン HUD がチャット上部にレンダリングされます：

> 📊 **AI Model Quota** &nbsp;·&nbsp; `Google AI Pro`
> 
> | Model | Remaining | Bar | Reset In |
> | :--- | :--- | :--- | :--- |
> | **Gemini 4 Argon** | `12.7%` ⚠️ | `█░░░░░░░░░` | 5d 17h |
> | **Gemini 3.8 Flash** 🎯 | `75.9%` 🟢 | `████████░░` | 1h 22m |
> | **Claude Opus 5.5** | `32.9%` 🟡 | `███░░░░░░░` | 5d 17h |
> | **Claude Sonnet 5.5** | `32.9%` 🟡 | `███░░░░░░░` | 5d 17h |
> | **GPT-OSS 120B** | `32.9%` 🟡 | `███░░░░░░░` | 5d 17h |

---

### 2. CLI モード (`agq` / `agq-hud`)

ターミナルや PowerShell から直接実行できます：

```bash
# サマリー表示
agq

# 詳細一覧（Low / Medium / High 全モデル）
agq -v

# JSON 形式で出力
agq --json

# バージョン確認
agq --version
```

#### CLI 出力例:

```text
⚡ AGQ HUD — Model Quota Monitor
Tier: Google AI Pro (user@example.com)

──────────────────────────────────────────────────────────────
 Model              Remaining Gauge         Resets In     
──────────────────────────────────────────────────────────────
 Gemini 4 Argon     12.7%     [█░░░░░░░░░]  5d 17h        
 Gemini 3.8 Flash   75.9%     [████████░░]  1h 22m        
 Claude Opus 5.5    32.9%     [███░░░░░░░]  5d 17h        
 Claude Sonnet 5.5  32.9%     [███░░░░░░░]  5d 17h        
 GPT-OSS 120B       32.9%     [███░░░░░░░]  5d 17h        
──────────────────────────────────────────────────────────────
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
