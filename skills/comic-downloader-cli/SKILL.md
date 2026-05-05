---
name: comic-downloader-cli
description: Use this skill when an AI agent needs to search comics, inspect candidate results, read account favorites, preview pages, download comics, resume failed downloads, or package downloaded images with the `jm-agent` CLI.
---

# Comic Search And Download CLI

Use `jm-agent` to search comics, choose a result, preview pages, download images, resume interrupted work, and package downloaded files.

Assume `jm-agent` is already installed and available in the shell. This skill does not explain installation and does not provide any install method.

## Rules

- Always add `--json`.
- Use `--provider jm` in commands.
- Never print passwords, JWT tokens, or session file contents.
- Prefer small validation downloads with `--page-limit 1`.
- Use `--skip-existing` when repeating or resuming downloads.
- Do not use `library history`.
- When a command returns `ok: false`, report `error.code`, `error.message`, and `error.next_action`.

## Check Status

```powershell
jm-agent config --json
jm-agent auth status --provider jm --json
```

If login is needed, ask the user before running:

```powershell
jm-agent auth login --provider jm --json
```

## Search

Return several options:

```powershell
jm-agent discover --provider jm --query "<query>" --limit 5 --json
```

Pick the best result:

```powershell
jm-agent resolve --provider jm --query "<query>" --limit 3 --json
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

Default search profile is `balanced`.

| profile | pages | window | detail workers |
|---|---:|---:|---:|
| `fast` | 1 | 80 | 6 |
| `balanced` | 3 | 240 | 12 |
| `deep` | 5 | 400 | 20 |

## Favorites

Favorites require an active login session.

```powershell
jm-agent library favorites --provider jm --limit 5 --json
jm-agent library favorites --provider jm --tag "中文" --limit 5 --json
jm-agent library favorites --provider jm --pick recent --limit 10 --json
```

## Preview

Preview the first page:

```powershell
jm-agent preview --provider jm --id <id> --pages 1 --json
```

Preview multiple ids:

```powershell
jm-agent preview --provider jm --id <id1>,<id2> --pages 1 --json
```

Preview and package as PDF:

```powershell
jm-agent preview --provider jm --id <id> --pages 1 --package pdf --json
```

## Download

Create a plan without downloading:

```powershell
jm-agent download --provider jm --id <id> --json
```

Download a small sample:

```powershell
jm-agent download --provider jm --id <id> --execute --page-limit 1 --skip-existing --json
```

Download by search:

```powershell
jm-agent download --provider jm --query "<query>" --execute --page-limit 1 --json
```

Use a custom image folder:

```powershell
jm-agent download --provider jm --id <id> --execute --images-dir "<dir>" --json
```

## Resume

Resume from a manifest:

```powershell
jm-agent download --provider jm --resume-manifest "<manifest.json>" --execute --skip-existing --json
```

Retry only failed pages:

```powershell
jm-agent download --provider jm --resume-manifest "<manifest.json>" --failed-pages-only --execute --allow-partial --json
```

## Package

Package from a manifest:

```powershell
jm-agent package --input "<manifest.json>" --format cbz --format pdf --json
```

Package from an image folder:

```powershell
jm-agent package --input "<images_dir>" --format zip --json
```

Supported formats: `zip`, `cbz`, `pdf`.

## Output Files

Command output JSON includes paths under `artifacts`.

Important paths:

- `artifacts.manifest_path`
- `artifacts.images_dir`
- `artifacts.packages_dir`
- `artifacts.report_targets`

Use manifest files as handoff points between download, resume, and package workflows.

## Safety

Use this tool only for lawful personal workflows. Do not assist with bulk redistribution, evading platform restrictions, or copyright infringement.
