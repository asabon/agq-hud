---
name: prepare-release
description: Prepare a release for agq-hud. Checks main CI, analyzes commits/diffs since the previous tag to write release notes, updates package.json, plugin.json, src/index.ts, bin/agq.cjs, CHANGELOG.md, and README.md, creates a GitHub Draft Release, and opens a release PR.
---

# Release Preparation Skill (`prepare-release`)

Execute this procedure when instructed by the user to "prepare a release", "release vX.Y.Z", etc.
This skill analyzes git commit history and code diffs since the previous release tag to generate high-quality release notes, updates both [`CHANGELOG.md`](../../../CHANGELOG.md) and the GitHub Draft Release, and keeps [`plugin.json`](../../../plugin.json) and the bundled standalone binary [`bin/agq.cjs`](../../../bin/agq.cjs) synchronized.

---

## 📋 Execution Steps

### 1. Pre-Release Verification, Diff Analysis, and Version Determination

1. **Verify `main` Branch and Ensure CI Passes**:
   Update the base `main` branch and verify that GitHub Actions (CI) succeeded on the latest commit.

   ```powershell
   git switch main
   git pull origin main
   gh run list --branch main --workflow "CI" --limit 1
   ```

   - Ensure status is `completed / success` (can be skipped for initial releases if no previous workflow runs exist).

2. **Analyze Diffs Since Previous Tag**:
   Fetch the previous release tag and inspect the commit list and code diffs up to `HEAD`.

   ```powershell
   $prevTag = git describe --tags --abbrev=0
   git log "$prevTag..HEAD" --oneline
   git diff --stat "$prevTag..HEAD"
   ```

3. **Determine the Version**:
   - If the user specifies a version (e.g. `0.1.0`), use it.
   - Otherwise, determine based on semantic versioning rules (minor bump if `feat:` exists, patch bump for `fix:` / `docs:` / `chore:`).

4. **Create a Topic Branch**:

   ```powershell
   git switch -c chore/release-vX.Y.Z
   ```

---

### 2. Generate Release Notes, Bump Versions, Build, and Create Draft Release

1. **Draft Release Notes**:
   - Organize notes into clear categories (`### 🚀 Features`, `### 🐛 Bug Fixes & Improvements`, `### 📖 Documentation & Maintenance`, etc.) based on the commits and diffs.
   - Exclude release-preparation commits themselves from the release notes.

2. **Update Version Numbers**:
   - Update `version` in [`package.json`](../../../package.json) (e.g. `"0.1.0"`).
   - Update `version` in [`plugin.json`](../../../plugin.json) (e.g. `"0.1.0"`).
   - Update `VERSION` constant in [`src/index.ts`](../../../src/index.ts) (e.g. `const VERSION = '0.1.0';`).

3. **Update `CHANGELOG.md`**:
   - Add a new `## [vX.Y.Z] - YYYY-MM-DD` section directly below the header separator (`---`) in [`CHANGELOG.md`](../../../CHANGELOG.md) and append the drafted release notes beneath it.

4. **Run Build & Typecheck**:
   - Rebuild the single-file distribution bundle [`bin/agq.cjs`](../../../bin/agq.cjs).

   ```powershell
   npm run typecheck
   npm run build
   ```

5. **Review `README.md`**:
   - If new features or CLI options were introduced, update documentation sections in [`README.md`](../../../README.md) and [`README.ja.md`](../../../README.ja.md).

6. **Create or Update GitHub Draft Release**:
   - Write the current release notes to `scratch/release_notes.md`, remove any stale draft release, and create a fresh one.

   ```powershell
   $draftIds = gh api repos/:owner/:repo/releases --jq '.[] | select(.draft == true) | .id'
   foreach ($id in $draftIds) {
     if ($id) { gh api -X DELETE "repos/:owner/:repo/releases/$id" }
   }
   gh release create "vX.Y.Z" --draft --title "vX.Y.Z" --notes-file "scratch/release_notes.md"
   Remove-Item "scratch/release_notes.md" -Force
   ```

7. **Commit Changes**:

   ```powershell
   git add package.json plugin.json src/index.ts bin/agq.cjs CHANGELOG.md README.md README.ja.md
   git commit -m "chore: bump version and update CHANGELOG for release vX.Y.Z"
   ```

---

### 3. Create Pull Request

1. **Push Branch to Remote**:

   ```powershell
   git push -u origin chore/release-vX.Y.Z
   ```

2. **Open PR with GitHub CLI (`--body-file` is mandatory)**:
   - Write PR summary and release notes into `scratch/pr_body.md` and create the PR.

   ```powershell
   gh pr create --title "chore: release vX.Y.Z" --body-file "scratch/pr_body.md" --base main
   Remove-Item "scratch/pr_body.md" -Force
   gh pr checks --watch
   ```

3. **Notify User & Request Review**:
   - Share the PR URL with the user and request review of `CHANGELOG.md` and merge into `main`.

---

## ⏩ Next Step

Once the user merges the PR, guide them to execute the [`publish-release`](../publish-release/SKILL.md) skill to tag and publish the release.
