# JM Agent CLI

Agent-first JMComic CLI packaged for npm. This is the JS/Node rewrite of the Python prototype in `D:\Project\jm\JM Agent CLI`.

## Basics

- Package name: `jm-agent-cli`
- CLI command: `jm-agent`
- Node.js: `>=20`
- Provider: `jm`
- Not migrated: `eh`
- Default output: structured JSON

## Usage

```powershell
npm install
node .\bin\jm-agent.js config --json
```

Local bin link:

```powershell
npm link
jm-agent config --json
```

Common commands:

```powershell
jm-agent discover --provider jm --query love --limit 5 --json
jm-agent resolve --provider jm --query love --limit 3 --json
jm-agent preview --provider jm --id 1429850 --pages 1 --package pdf --json
jm-agent download --provider jm --id 1429850 --execute --page-limit 1 --json
jm-agent package --input "<manifest.json>" --format cbz --format pdf --json
```

## Verification

Offline release check:

```powershell
npm run verify
```

Online JM smoke:

```powershell
npm run smoke:online
```

Before public npm publication, verify package-name availability and review the origin/licensing risk of `tools/vendor/JmComic.bundle.cjs`.
