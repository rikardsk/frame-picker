# GEMINI.md - Antigravity Rules


## Core Preferences
- Use TypeScript; avoid JavaScript.
- Favor async/await over promises.
- Functions under 30 lines; use early returns.


## Safety Rules
- Pre-approved: Running any PowerShell commands (including Select-String queries), Vitest tests, and Vite builds.
- Otherwise, NEVER execute commands without my approval.
- Limit file access to current workspace.
- Confirm destructive actions (rm, sudo).


## Testing & Git
- Don't run browser tests without me asking you to do so.
- Don't run git commands without me asking you to do so.
- Write tests for logic changes.
- Use conventional commits (feat:, fix:).
