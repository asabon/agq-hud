# CHANGELOG

すべての重要な変更は本ファイルに記録されます。
バージョン管理は [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

---

## [v0.0.1] - 2026-11-08

### 🚀 新機能 / Features
- **Antigravity 2.0 / CLI / IDE 向け公式仕様プラグインの初期リリース**:
  - `plugin.json` および `hooks.json` に準拠した `agq-hud` プラグイン。
- **トークン消費ゼロのインラインチャット HUD (`PreInvocation` フック)**:
  - `metadata.user_markdown` によるグラフィカル残量バー（`████████░░`）表示。
  - `systemMessage: ""` による完全ゼロオーバーヘッド（モデルへの入力トークン消費ゼロ）。
  - 会話中のアクティブモデルに自動でターゲットマーク（🎯）を付与。
- **スタンドアロン CLI ツール (`agq` / `agq-hud`)**:
  - ターミナルから各モデル（Gemini, Claude, GPT-OSS）の残量と次回リセット日時を即座に確認可能。
  - `-v` / `--verbose`: 低・中・高バリアントを含む全サブモデル一覧表示。
  - `--json`: スクリプト連携用 JSON 出力。
  - `-V` / `--version`: バージョン表示。
- **ゼロ依存 & 高速起動**:
  - `esbuild` により全ロジックを単一ファイル (`bin/agq.cjs`) に事前バンドル。
  - 外部 npm パッケージに依存せず Node.js 標準ライブラリのみで高速起動。
- **マルチプラットフォーム自動探索**:
  - Antigravity 稼働中の環境変数（`ANTIGRAVITY_LS_ADDRESS`, `ANTIGRAVITY_CSRF_TOKEN`）を自動検知。
  - 外部シェル実行時も Windows / macOS / Linux 上で稼働中の `language_server` プロセスとポートを自動検知。
