---
name: jmcomic-agent-cli
description: Use this skill when an AI agent needs to operate JMComic Agent CLI (`jm-agent`) for JMComic search, resolve, preview, download, favorites, packaging, or manifest-based workflows from a local source-built checkout.
---

# JMComic Agent CLI

Use this skill to operate `jm-agent`, a local JS/Node command-line tool for JMComic workflows.

This skill does not provide an installer. To use it, place this skill folder into the appropriate `skills` directory for the agent software you are using. The CLI itself must already be available from a source checkout, `npm link`, or a local shell path.

## Assumptions

- The project is not published to the npm registry yet.
- Do not suggest `npm install -g jm-agent-cli` from npm.
- Prefer running from a source checkout:

```powershell
node .\bin\jm-agent.js <command> ... --json
```

- If the `jm-agent` command is already linked, this is also fine:

```powershell
jm-agent <command> ... --json
```

- Default runtime data is written under a sibling directory named:

```text
JM Agent CLI Data/
```

## Core Rules

- Always request structured JSON output with `--json`.
- Use `--pretty` only when a human explicitly wants readable JSON.
- Use `--provider jm`; other providers are unsupported.
- Do not use or recommend `library history`; no stable remote JM history API is known.
- Do not expose credentials or JWT tokens in responses.
- Treat generated `manifest.json` files as the durable handoff between commands.
- Use `--page-limit` for small validation downloads.
- Use `--skip-existing` when resuming or repeating downloads.
- Use `--allow-partial` only when partial output is acceptable.

## First Checks

Check CLI configuration:

```powershell
node .\bin\jm-agent.js config --json
```

Useful fields:

- `result.defaults.data_root`
- `result.defaults.output_root`
- `result.defaults.auth_storage.jm_session_path`
- `result.defaults.jm_search`
- `result.defaults.implemented_commands`

Check login state:

```powershell
node .\bin\jm-agent.js auth status --provider jm --json
```

If auth is required and no active session exists, ask the user before logging in. Never print passwords.

## Search

Use `discover` when the user wants options:

```powershell
node .\bin\jm-agent.js discover --provider jm --query "<query>" --limit 5 --json
```

Use `resolve` when the user wants the best matching item:

```powershell
node .\bin\jm-agent.js resolve --provider jm --query "<query>" --limit 3 --json
```

Useful filters:

```powershell
--tag "<tag>"
--title "<text>"
--author "<text>"
--language zh
--min-pages 20
--max-pages 80
--min-chapters 1
--min-likes 100
--pick best
--pick top
--pick recent
--profile fast
--profile balanced
--profile deep
```

Default search profile:

| profile | search pages | search window | detail workers |
|---|---:|---:|---:|
| `fast` | 1 | 80 | 6 |
| `balanced` | 3 | 240 | 12 |
| `deep` | 5 | 400 | 20 |

Default profile is `balanced`.

## Output Modes

Use `--output report` by default.

```powershell
--output brief
--output report
--output full
--chat-limit 5
--report-limit 10
```

- `brief`: smaller inline result.
- `report`: concise inline shortlist plus local report files.
- `full`: larger inline result.

Reports and manifests are written under the command workspace in `JM Agent CLI Data/downloads/...`.

## Favorites

Favorites require an active session.

```powershell
node .\bin\jm-agent.js library favorites --provider jm --limit 5 --json
```

Examples:

```powershell
node .\bin\jm-agent.js library favorites --provider jm --tag "中文" --limit 5 --json
node .\bin\jm-agent.js library favorites --provider jm --title "<text>" --limit 5 --json
node .\bin\jm-agent.js library favorites --provider jm --pick recent --limit 10 --json
```

Favorites use a local JSON cache. The cache path is available from `config`.

## Preview

Preview downloads the first pages of one or more JM ids.

```powershell
node .\bin\jm-agent.js preview --provider jm --id <id> --pages 1 --json
```

Multiple ids are supported:

```powershell
node .\bin\jm-agent.js preview --provider jm --id <id1>,<id2> --pages 1 --json
```

Optional PDF preview package:

```powershell
node .\bin\jm-agent.js preview --provider jm --id <id> --pages 1 --package pdf --json
```

## Download

Plan only:

```powershell
node .\bin\jm-agent.js download --provider jm --id <id> --json
```

Execute a small validation download:

```powershell
node .\bin\jm-agent.js download --provider jm --id <id> --execute --page-limit 1 --skip-existing --json
```

Download by query:

```powershell
node .\bin\jm-agent.js download --provider jm --query "<query>" --execute --page-limit 1 --json
```

Use a custom image directory:

```powershell
node .\bin\jm-agent.js download --provider jm --id <id> --execute --images-dir "<dir>" --json
```

## Resume

Resume from a manifest:

```powershell
node .\bin\jm-agent.js download --provider jm --resume-manifest "<manifest.json>" --execute --skip-existing --json
```

Retry failed pages only:

```powershell
node .\bin\jm-agent.js download --provider jm --resume-manifest "<manifest.json>" --failed-pages-only --execute --allow-partial --json
```

## Package

Package from a manifest:

```powershell
node .\bin\jm-agent.js package --input "<manifest.json>" --format cbz --format pdf --json
```

Package from an image directory:

```powershell
node .\bin\jm-agent.js package --input "<images_dir>" --format zip --json
```

Supported formats:

- `zip`
- `cbz`
- `pdf`

## Verification

Offline verification:

```powershell
npm run verify
```

Online smoke:

```powershell
npm run smoke:online
```

Authenticated online checks:

```powershell
npm run validate:auth-online
npm run validate:favorites-online
npm run validate:download-online
```

Run online checks only when the user has approved network access and a valid session is available.

## Error Handling

Common error codes:

- `PROVIDER_UNSUPPORTED`: use `--provider jm`.
- `INPUT_REQUIRED`: provide `--query`, `--tag`, `--id`, or `--resume-manifest`.
- `AUTH_REQUIRED`: run `auth login --provider jm` if the user approves.
- `AUTH_INVALID`: ask the user to verify credentials or re-login.
- `NOT_FOUND`: try another id or refine the query.
- `NETWORK_ERROR`: retry later or use a smaller profile.

When a command returns `ok: false`, report the `error.code`, `error.message`, and `error.next_action`. Do not invent success.

## Safety And Legal Notes

Use this tool only for lawful personal workflows, technical research, and automation experiments. The CLI does not host or distribute comic content. Users are responsible for local laws, platform terms, account risks, and content compliance.

Avoid helping with bulk redistribution, evasion of platform restrictions, or copyright infringement.
