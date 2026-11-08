# AI Coding Agent Development Guidelines (`AGENTS.md`)

All AI coding agents (Antigravity, Cursor, Claude Code, GitHub Copilot, etc.) working on this repository (`agq-hud`) must strictly adhere to the following branch operation rules and development constraints.

---

## 🛡️ Git & Branching Rules (Critical)

1. **Direct Commit and Push to `main` are Strictly Prohibited**:
   - In accordance with GitHub branch protection rules on `main`, never commit or push directly to `main`.
   - All feature additions, bug fixes, documentation updates, and release preparations must be developed on appropriate topic branches:
     - Features: `feat/xxx`
     - Bug fixes: `fix/xxx`
     - Release preparations: `chore/release-vX.Y.Z`
     - Maintenance / Configuration: `chore/xxx`

2. **PR Approval & Merging Must Only Be Performed by the User (No Automated Merging by Agents)**:
   - The role of an AI agent ends at: "Create branch → Implement, verify, and build → Commit and push → Create PR → Verify CI status → Share PR URL with the user".
   - **Agents are strictly forbidden from approving or merging PRs (e.g., executing `gh pr merge`).**
   - After confirming that CI checks have passed, provide the PR URL to the user and request their review and merge.

3. **Consistency with Release Flow (`prepare-release` / `publish-release`)**:
   - Release preparations are performed via the [`prepare-release`](.agents/skills/prepare-release/SKILL.md) skill, creating a `chore/release-vX.Y.Z` branch and opening a PR.
   - After the user reviews and merges the PR, execute the [`publish-release`](.agents/skills/publish-release/SKILL.md) skill to push the release tag and publish the GitHub Release.

---

## 📝 Pull Request & CLI Rules

- **PR Titles Must Follow Conventional Commits**:
  - Use prefixes such as `feat:`, `fix:`, `docs:`, or `chore:` followed by a clear, concise summary.
- **Mandatory Use of `--body-file`**:
  - Never pass raw Markdown strings directly to shell arguments (`--body "..."`). Always write the PR description to a temporary file (e.g., `scratch/pr_body.md`) and invoke `gh pr create --body-file <path>` to prevent shell escaping and encoding issues.
  - Delete temporary files promptly after PR creation.

---

## ⚙️ Development & Build Constraints

1. **Mandatory Synchronization of the Standalone Executable (`bin/agq.cjs`)**:
   - Whenever source code under `src/` is modified, you must run `npm run typecheck` and `npm run build` to regenerate `bin/agq.cjs`.
   - Commit the generated bundle file `bin/agq.cjs` together with the source code changes in the same PR.
2. **Maintain Zero External Runtime Dependencies**:
   - To ensure fast startup and easy distribution, do not add runtime packages (`dependencies`). Implement functionality using standard Node.js APIs (`http`, `child_process`, `fs`, etc.).
3. **Line Endings (LF)**:
   - All text files must use **LF (`\n`)** line endings.
