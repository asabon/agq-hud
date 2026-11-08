---
name: prepare-release
description: Prepare a release for agq-hud. Checks main CI, analyzes commits/diffs since the previous tag to write release notes, updates package.json, plugin.json, src/index.ts, bin/agq.cjs, CHANGELOG.md, and README.md, creates a GitHub Draft Release, and opens a release PR.
---

# リリース準備スキル (`prepare-release`)

ユーザーから「リリースして」「リリース準備をして」「vX.Y.Z をリリースしたい」等の指示を受けた際に実行する手順です。
前回リリースタグからのコミット履歴およびコード差分を解析して高品質なリリースノートを生成し、[`CHANGELOG.md`](../../../CHANGELOG.md) と GitHub Draft Release の両方に反映します。
また、Antigravity プラグインの仕様に合わせ、[`plugin.json`](../../../plugin.json) やバンドル済み実行ファイル [`bin/agq.cjs`](../../../bin/agq.cjs) も確実に更新します。

---

## 📋 実行手順

### 1. リリース前の状態確認 & 差分解析・バージョン決定

1. **`main` ブランチの最新化と CI 成功を確認**:
   ベースとなる `main` ブランチを最新化し、最新コミットに対する GitHub Actions (CI) が成功していることを確認します。

   ```powershell
   git switch main
   git pull origin main
   gh run list --branch main --workflow "CI" --limit 1
   ```

   - ステータスが `completed / success` であることを確認します（ワークフローが存在しない初回等はスキップ可能）。

2. **前回リリースタグからの差分解析**:
   直前のリリースタグを取得し、`HEAD` までのコミット一覧および変更差分を確認します。

   ```powershell
   $prevTag = git describe --tags --abbrev=0
   git log "$prevTag..HEAD" --oneline
   git diff --stat "$prevTag..HEAD"
   ```

3. **バージョン情報の決定**:
   - ユーザーからバージョン（例: `0.1.0`）が指定された場合はそのバージョンを使用します。
   - 指定がない場合は、`prevTag` からの変更規模（`feat:` 等の新機能があればマイナー更新、`fix:` / `docs:` / `chore:` のみならパッチ更新）に基づいて決定します。

4. **トピックブランチの作成**:

   ```powershell
   git switch -c chore/release-vX.Y.Z
   ```

---

### 2. リリースノート作成・バージョン更新・ビルド・Draft Release 作成

1. **リリースノート本文の作成**:
   - コミット履歴とコード差分から **「何が追加・改善・修正されたのか」が利用者・開発者に一目で伝わる要約** をカテゴリ別（`### 🚀 新機能 / Features`、`### 🐛 バグ修正・改善 / Bug Fixes & Improvements`、`### 📖 ドキュメント・開発基盤 / Documentation & DX` 等）に作成します。
   - リリース作業自体のコミットはリリースノートに含めません。

2. **各ファイルのバージョン更新**:
   - [`package.json`](../../../package.json) の `version` を更新（例: `"0.1.0"`）
   - [`plugin.json`](../../../plugin.json) の `version` を更新（例: `"0.1.0"`）
   - [`src/index.ts`](../../../src/index.ts) の `VERSION` 定数を更新（例: `const VERSION = '0.1.0';`）

3. **`CHANGELOG.md` の更新**:
   - [`CHANGELOG.md`](../../../CHANGELOG.md) の既存バージョンの一番上（`---` の直後）に `## [vX.Y.Z] - YYYY-MM-DD` セクションを追加してリリースノートを追記します。

4. **ビルド & 型チェック実行**:
   - プラグイン配布用単一ファイル [`bin/agq.cjs`](../../../bin/agq.cjs) を最新コードでリビルドします。

   ```powershell
   npm run typecheck
   npm run build
   ```

5. **`README.md` の点検（新機能や重要仕様変更がある場合）**:
   - 新機能や CLI オプション追加がある場合は、[`README.md`](../../../README.md) の機能説明や使用例セクションも更新します。

6. **GitHub Draft Release の作成（または更新）**:
   - `CHANGELOG.md` の今回分リリースノート本文を `scratch/release_notes.md` に書き出し、既存のドラフトがあれば削除した上で新規作成します。

   ```powershell
   $draftIds = gh api repos/:owner/:repo/releases --jq '.[] | select(.draft == true) | .id'
   foreach ($id in $draftIds) {
     if ($id) { gh api -X DELETE "repos/:owner/:repo/releases/$id" }
   }
   gh release create "vX.Y.Z" --draft --title "vX.Y.Z" --notes-file "scratch/release_notes.md"
   Remove-Item "scratch/release_notes.md" -Force
   ```

7. **コミットの作成**:

   ```powershell
   git add package.json plugin.json src/index.ts bin/agq.cjs CHANGELOG.md README.md
   git commit -m "chore: リリース vX.Y.Z に向けたバージョン・CHANGELOG更新"
   ```

---

### 3. Pull Request の作成

1. **ブランチをリモートへ push**:

   ```powershell
   git push -u origin chore/release-vX.Y.Z
   ```

2. **GitHub CLI で PR を作成 (`--body-file` 必須)**:
   - `scratch/pr_body.md` にリリースノートと確認事項を記載して PR を作成します。

   ```powershell
   gh pr create --title "chore: リリース vX.Y.Z" --body-file "scratch/pr_body.md" --base main
   Remove-Item "scratch/pr_body.md" -Force
   gh pr checks --watch
   ```

3. **ユーザーへの報告 & レビュー依頼**:
   - PR URL を案内し、`CHANGELOG.md` の確認および `main` へのマージを依頼します。

---

## ⏩ 次のステップ案内

PR がマージされたら、タグ付けと本番公開を行う [`publish-release`](../publish-release/SKILL.md) スキルを実行することをユーザーに案内してください。
