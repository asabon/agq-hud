# AI コーディングエージェント開発ガイドライン (`AGENTS.md`)

本リポジトリ（`agq-hud`）で作業するすべての AI コーディングエージェント（Antigravity, Cursor, Claude Code, GitHub Copilot 等）は、以下のブランチ運用ルールおよび開発制約を厳格に遵守してください。

---

## 🛡️ Git & ブランチ運用ルール（最重要）

1. **`main` ブランチへの直接コミット・プッシュの厳格な禁止**:
   - リモートの GitHub `main` ブランチ保護ルールに従い、`main` への直接コミットおよびプッシュは絶対に行わないでください。
   - すべての機能追加・バグ修正・ドキュメント更新・リリース準備は、必ず用途に応じたトピックブランチを作成して作業してください。
     - 新機能: `feat/xxx`
     - バグ修正: `fix/xxx`
     - リリース準備: `chore/release-vX.Y.Z`
     - 雑務・設定: `chore/xxx`

2. **Pull Request の承認・マージはユーザーのみが実施（エージェントによる自動マージ禁止）**:
   - AI エージェントの役割は「ブランチ作成 → 実装・検証・ビルド → コミット・プッシュ → PR 作成 → CI 通過確認・URL 案内」までです。
   - **エージェントが自ら PR の承認（Approve）やマージ（`gh pr merge` 等）を実行することは固く禁止します。**
   - CI のパスを確認後、ユーザーに PR の URL を案内し、ユーザーによるレビューおよびマージを依頼して待機してください。

3. **リリースフローとの整合性 (`prepare-release` / `publish-release`)**:
   - リリース準備はスキル [`prepare-release`](.agents/skills/prepare-release/SKILL.md) を通じて `chore/release-vX.Y.Z` ブランチを作成し、PR を作成します。
   - ユーザーが PR を確認・マージした後に、スキル [`publish-release`](.agents/skills/publish-release/SKILL.md) を実行してリリースタグの push と GitHub Release の正式公開を行います。

---

## 📝 Pull Request 作成 & CLI 運用ルール

- **PR タイトルは Conventional Commits に準拠**:
  - `feat:`, `fix:`, `docs:`, `chore:` プレフィックスに続けて、変更要約をわかりやすく記述してください。
- **`--body-file` の使用義務化**:
  - シェルコマンドの引数（`--body "..."`）に直接 Markdown を渡さず、必ず一時ファイル（例: `scratch/pr_body.md`）を経由して `gh pr create --body-file <path>` を使用してください（PowerShell 等のエスケープ破損防止のため）。
  - 送信完了後は一時ファイルを速やかに削除してください。

---

## ⚙️ 開発・ビルド制約

1. **単一実行ファイル (`bin/agq.cjs`) の同期更新義務**:
   - `src/` 配下のソースコードを変更した際は、必ず `npm run typecheck` および `npm run build` を実行して `bin/agq.cjs` を最新状態に再生成してください。
   - 配布用バンドルファイル `bin/agq.cjs` はソースコードと同じ PR に含めてコミットしてください。
2. **ゼロ外部依存の維持**:
   - 高速起動と配布の容易さを維持するため、ランタイム依存パッケージ（`dependencies`）は原則として追加せず、Node.js 標準 API（`http`, `child_process`, `fs` 等）で実装してください。
3. **改行コード (LF)**:
   - すべてのテキストファイルは **LF (`\n`)** で統一してください。
