---
name: publish-release
description: Publish a new release for agq-hud. Pushes the release tag, publishes the GitHub Draft Release, and verifies the published Release on GitHub.
---

# Release Publication Skill (`publish-release`)

Execute this procedure when the user notifies you that the release PR has been merged, or instructs you to "publish the release".
This skill tags the commit, pushes the tag, and publishes the GitHub Draft Release created during `prepare-release`.

---

## 📋 Execution Steps

### 1. Update Local `main` & Cleanup Topic Branch

```powershell
git switch main
git pull origin main
git fetch --prune
# Delete the local release branch now that it is merged
git branch -D chore/release-vX.Y.Z
```

---

### 2. Create & Push Release Tag

1. Check the version number in [`package.json`](../../../package.json):

   ```powershell
   $ver = node -p "require('./package.json').version"
   Write-Host "Releasing version: v$ver"
   ```

2. Create the tag (e.g. `v0.1.0`) and push to remote:

   ```powershell
   git tag "v$ver"
   git push origin "v$ver"
   ```

---

### 3. Publish GitHub Release

1. Convert the Draft Release created in `prepare-release` into a published release (`--draft=false`):

   ```powershell
   # Publish draft release associated with this tag
   gh release edit "v$ver" --draft=false
   ```

   - If no draft release exists, create and publish one directly using `CHANGELOG.md`:

   ```powershell
   gh release create "v$ver" --title "v$ver" --notes-file "CHANGELOG.md"
   ```

2. Confirm the published release URL and share it with the user:
   - GitHub Release URL: `https://github.com/asabon/agq-hud/releases/tag/v$ver`
   - Installation guide:
     ```bash
     agy plugin install https://github.com/asabon/agq-hud
     ```
