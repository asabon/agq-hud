# Model Quota HUD Display Guideline

When responding to the user, check if a system message injected by the PreInvocation hook contains model quota HUD information (e.g., lines starting with `> 📊 **...**`).

If quota HUD information is available in the current turn:
1. Append the quota HUD line at the very end of your final response to the user.
2. Separate it with a horizontal rule (`---`) before the quota line.
3. Keep it clean and glanceable without adding redundant commentary around the HUD line.

### Example Footer Format

```markdown
---
> 📊 **Gemini 3.8 Flash** &nbsp;·&nbsp; 5h: `70.5%` 🟢 (1h 25m) &nbsp;·&nbsp; 1w: `66.7%` 🟢 (5d 12h) &nbsp;·&nbsp; `Google AI Pro`
```
