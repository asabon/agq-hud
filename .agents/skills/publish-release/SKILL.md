---
name: publish-release
description: Publish a new release for agq-hud. Pushes the release tag, publishes the GitHub Draft Release, and verifies the published Release on GitHub.
---

# リリース公開スキル (`publish-release`)

ユーザーから「リリース PR をマージしました」「公開してください」と連絡を受けた際に実行する手順です。
リリースタグを作成・push し、`prepare-release` で作成された Draft Release を正式な Release として公開します。

---

## 📋 実行手順

### 1. ローカル `main` の最新化 & トピックブランチの削除

```powershell
git switch main
git pull origin main
git fetch --prune
# 不要になったリリース用ローカルブランチを削除
git branch -D chore/release-vX.Y.Z
```

---

### 2. リリースタグの作成 & push

1. [`package.json`](../../../package.json) に記載されているバージョン番号を確認します：

   ```powershell
   $ver = node -p "require('./package.json').version"
   Write-Host "Releasing version: v$ver"
   ```

2. 対応するタグ（例: `v0.1.0`）を作成し、リモートへ push します：

   ```powershell
   git tag "v$ver"
   git push origin "v$ver"
   ```

---

### 3. GitHub Release の正式公開

1. `prepare-release` で作成された Draft Release を正式公開（`--draft=false`）に切り替えます：

   ```powershell
   # タグに対応するドラフトを正式公開
   gh release edit "v$ver" --draft=false
   ```

   - もしドラフトが存在しない場合は、`CHANGELOG.md` の最新エントリから即座に作成・公開します：

   ```powershell
   gh release create "v$ver" --title "v$ver" --notes-file "CHANGELOG.md"
   ```

2. 公開された Release の URL を確認し、ユーザーへ案内して完了とします：
   - GitHub Release ページ URL: `https://github.com/asabon/agq-hud/releases/tag/v$ver`
   - インストール案内:
     ```bash
     agy plugin install https://github.com/asabon/agq-hud
     ```
