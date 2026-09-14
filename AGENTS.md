# AGENTS.md

## Scope

These instructions apply to the entire ThroughMyLens repository unless a more specific `AGENTS.md` exists in a subdirectory.

## General working rules

- Inspect the existing implementation before changing code.
- Preserve unrelated user/Codex changes; do not overwrite, revert, or delete work outside the task scope.
- Prefer minimal, targeted changes over broad rewrites.
- Reuse existing components, utilities, styles, and architecture where practical.
- Do not introduce new dependencies unless they are clearly justified by the task.
- Keep the current project structure and naming conventions consistent.

## Git and GitHub workflow

- Before modifying files, inspect `git status`.
- Before committing, inspect `git status` and the relevant diff.
- Respect `.gitignore`; do not force-add ignored files unless explicitly required.
- Never commit `.env`, credentials, API keys, database passwords, tokens, secrets, or other private runtime configuration.
- `.env.example` may contain only safe placeholders and documented example values.
- Keep commits logically scoped; avoid mixing unrelated changes in one commit.
- Use concise, descriptive commit messages.
- Do not amend commits, reset history, rebase, force-push, or otherwise rewrite Git history unless explicitly requested.
- Do not push to GitHub unless the user explicitly asks to publish/deploy, or the task explicitly requires a push.
- `main` is the production deployment branch.
- A push to `main` may automatically trigger a Netlify deployment.
- After committing or pushing, report the commit summary and validation results.

## Local development

### Frontend

Run the local Next.js development server with:

```powershell
corepack pnpm --filter=@throughmylens/web dev
```

Local frontend:

```text
http://localhost:3000
```

Use local development for immediate verification of frontend changes. Next.js Fast Refresh/HMR should normally reflect saved frontend changes without Git operations.

### Backend

FastAPI runs locally on:

```text
http://localhost:8000
```

Swagger:

```text
http://localhost:8000/docs
```

The FastAPI development process currently uses Uvicorn reload, so Python code changes should normally reload automatically.

### Local service startup

The complete local backend stack can be started with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-production-local.ps1
```

This startup flow manages:

- Docker Desktop readiness
- PostgreSQL
- MinIO
- FastAPI
- Cloudflare Tunnel

Do not start duplicate FastAPI or Tunnel processes if they are already running.

## Testing and validation

- Run the most relevant existing tests for the changed area.
- For frontend changes, run the applicable lint/typecheck/tests when practical.
- For backend changes, run the relevant Python tests.
- For route/UI work, verify the affected route locally before publishing.
- Do not claim a task is complete if validation failed.
- If a failure appears unrelated to the task, report it separately instead of hiding it.

## Design and UI work

- Read `DESIGN.md` before making visual, layout, animation, typography, spacing, or interaction changes.
- Preserve the established visual language unless the user explicitly requests a redesign.
- Do not replace an existing polished component with a simplified placeholder implementation.
- Mobile and desktop behavior should both be considered for user-facing changes.

## Deployment context

Current public frontend:

```text
https://poetic-moxie-3586c4.netlify.app
```

Current architecture:

```text
Netlify Next.js
    ↓
Cloudflare Quick Tunnel
    ↓
Local FastAPI :8000
    ↓
Docker
├─ PostgreSQL
└─ MinIO
```

The public frontend uses:

```text
NEXT_PUBLIC_API_BASE_URL
```

Cloudflare Quick Tunnel URLs are temporary and may change after restart. Do not hard-code a stale `trycloudflare.com` URL into source code.

`localhost:3000` remains supported for local frontend development and can run independently from the Netlify frontend. Both environments share the same local backend data when pointed at the same FastAPI/PostgreSQL/MinIO stack.

## Known deployment constraints

- `/docs` is a FastAPI route, not a Netlify frontend route.
- The Netlify `/admin` UI can load publicly, but remote authentication may still be affected by cross-site Cookie/CSRF behavior.
- Local admin access via `http://localhost:3000/admin` remains the reliable development path.
- A permanent domain and fixed Cloudflare Tunnel/API hostname will be configured later.

## Project documentation

- Read `DESIGN.md` for long-lived design principles.
- Read the current deployment/handoff document only when the task involves deployment, infrastructure, environment setup, Git/Netlify state, or known runtime limitations.
- Keep long-lived rules in `AGENTS.md`; keep temporary project state out of this file unless it materially affects development behavior.

## GitHub Projects workflow

GitHub Project is the canonical task/roadmap tracker for ThroughMyLens. It complements the repository; it does not replace Git, GitHub Issues, or source documentation.

### Project structure

Use the personal GitHub Project:

- Project: `ThroughMyLens Development`
- Project owner: `iozyang`
- Project number: `2`
- Project ID: `PVT_kwHOCOoOms4BjWY6`
- Repository: `iozyang/throughmylens`
- Production branch: `main`

Recommended fields:

- `Status`: Backlog / Ready / In Progress / Review / Done
- `Priority`: P0 / P1 / P2 / P3
- `Area`: Homepage / Work / Projects / Films / Places / Admin / Backend / Infrastructure
- `Types`: Feature / Bug / Performance / Design / Refactor / Infrastructure / Documentation

### Task representation

- Use a GitHub Issue for substantial implementation work, bugs, infrastructure changes, or work that needs acceptance criteria/history.
- Use a Project draft item only for early ideas that are not yet ready to become Issues.
- Do not create duplicate Issues/Project items for work already tracked elsewhere.
- Keep Issue titles concise and describe expected behavior, constraints, and acceptance criteria in the body.
- When a draft item becomes actionable, convert or replace it with a real Issue rather than maintaining two parallel task records.

### Status rules

- `Backlog`: valid idea/task, but not yet selected for implementation.
- `Ready`: sufficiently understood and ready to start.
- `In Progress`: active implementation has begun.
- `Review`: implementation is complete enough for validation, user review, or production verification.
- `Done`: required implementation, validation, and any explicitly required deployment are complete.

Do not mark an item `Done` when relevant tests are failing, required validation has not been performed, or an explicitly required deployment is still pending.

### Agent behavior

- When starting work on a tracked task, inspect the linked Issue/Project item before editing code.
- Inspect `git status` before making changes and preserve unrelated work.
- Move a tracked task to `In Progress` when implementation actually begins, if GitHub Project maintenance is part of the authorized task.
- Keep implementation scoped to the tracked task unless the user explicitly expands scope.
- After implementation, record relevant validation results and important technical notes in the Issue when useful.
- If user review or production verification is still needed, use `Review` rather than `Done`.
- Move to `Done` only after the task satisfies its acceptance criteria.
- Reference relevant commit or PR information when it materially helps traceability.
- Do not create, edit, close, or move GitHub Issues/Project items without user authorization or an established instruction to maintain the Project.
- GitHub Project updates do not deploy the website. Only code pushed to the production branch can trigger Netlify deployment.

### GitHub CLI

GitHub Projects may be managed with GitHub CLI (`gh`). The authenticated token must include the `project` scope.

The CLI integration for this Project has been verified for both read and write operations. Project item status changes made through `gh` are reflected in the GitHub Project board.

Check authentication:

```powershell
gh auth status
```

Add Projects permission when needed:

```powershell
gh auth refresh -s project
```

List projects:

```powershell
gh project list --owner iozyang
```

List this Project's fields:

```powershell
gh project field-list 2 --owner iozyang
```

View the ThroughMyLens project:

```powershell
gh project view 2 --owner iozyang
```

List items and useful fields:

```powershell
gh project item-list 2 --owner iozyang --field "Status" --field "Priority" --field "Area" --field "Types"
```

For machine-readable output or when terminal columns are truncated, prefer:

```powershell
gh project item-list 2 --owner iozyang --field "Status" --field "Priority" --field "Area" --field "Types" --format json
```

Create a repository Issue:

```powershell
gh issue create -R iozyang/throughmylens --title "<TITLE>" --body "<BODY>"
```

Add an Issue to the Project:

```powershell
gh project item-add 2 --owner iozyang --url "<ISSUE_URL>"
```

Update an Issue's Project status:

```powershell
gh project item-edit 2 --owner iozyang --url "<ISSUE_URL>" --field "Status" --value "In Progress"
```

Update other single-select fields in the same way:

```powershell
gh project item-edit 2 --owner iozyang --url "<ISSUE_URL>" --field "Priority" --value "P1"
```

Create a lightweight draft item only when an Issue is not yet warranted:

```powershell
gh project item-create 2 --owner iozyang --title "<TITLE>" --body "<BODY>"
```

Prefer human-readable field names and values for normal interactive work. Use GraphQL/node IDs only for advanced scripting where necessary.

### Relationship to other project documents

- `AGENTS.md`: long-lived agent working rules.
- `DESIGN.md`: long-lived visual/interaction principles.
- `docs/PROJECT_CONTEXT.md`: architecture and system understanding, when present.
- GitHub Project: what work is planned/in progress/done.
- GitHub Issues: detailed specification and history for individual work items.
- Git commits/PRs: implementation history.
- Deployment handoff documentation: current runtime/deployment state and temporary operational constraints.
