# audit-code operator handoff

Status: blocked
Provider: local-subprocess
Repo root: C:\Code\OpenCode-NIM
Artifacts dir: C:\Code\OpenCode-NIM\.audit-artifacts

Summary: Automatic local-subprocess work is exhausted. Remaining audit tasks require explicit audit results or an interactive provider such as claude-code, opencode, or subprocess-template.

Pending obligations:
- audit_tasks_completed
- audit_results_ingested
- synthesis_current

Useful artifact paths:
- operator handoff json: C:\Code\OpenCode-NIM\.audit-artifacts\operator-handoff.json
- operator handoff markdown: C:\Code\OpenCode-NIM\.audit-artifacts\operator-handoff.md
- incoming dir: C:\Code\OpenCode-NIM\.audit-artifacts\incoming
- session config: C:\Code\OpenCode-NIM\.audit-artifacts\session-config.json
- run ledger: C:\Code\OpenCode-NIM\.audit-artifacts\run-ledger.json
- audit tasks: C:\Code\OpenCode-NIM\.audit-artifacts\audit_tasks.json
- runtime validation tasks: C:\Code\OpenCode-NIM\.audit-artifacts\runtime_validation_tasks.json

Suggested evidence inputs:
- --results -> C:\Code\OpenCode-NIM\.audit-artifacts\incoming\audit-results.json
  Import structured audit-review results after manual or provider-assisted review finishes.
- --updates -> C:\Code\OpenCode-NIM\.audit-artifacts\incoming\runtime-validation-updates.json
  Merge runtime validation evidence updates gathered outside the wrapper.
- --external-analyzer-results -> C:\Code\OpenCode-NIM\.audit-artifacts\incoming\external-analyzer-results.json
  Import normalized external analyzer results such as Semgrep findings.

Suggested commands:
- audit-code --results "C:\Code\OpenCode-NIM\.audit-artifacts\incoming\audit-results.json"
- audit-code --updates "C:\Code\OpenCode-NIM\.audit-artifacts\incoming\runtime-validation-updates.json"
- audit-code --external-analyzer-results "C:\Code\OpenCode-NIM\.audit-artifacts\incoming\external-analyzer-results.json"

Interactive provider hint:
- Current provider is local-subprocess. If you want the backend to continue through an interactive provider instead of importing results manually, set "provider" in C:\Code\OpenCode-NIM\.audit-artifacts\session-config.json to "auto", "claude-code", "opencode", "subprocess-template", or "vscode-task", then run audit-code again from the repository root.
