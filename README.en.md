# JMComic Agent CLI

Agent-first JMComic command-line tool built with JS/Node. The first public version of this project is the JS implementation. It is designed for local source builds, structured JSON output, and automation-friendly workflows.

## Status

- Reserved package name: `jm-agent-cli`
- CLI command: `jm-agent`
- Runtime: Node.js `>=20`
- Provider: JMComic
- Not published to the npm registry yet
- Install from source or use local `npm link`

## Features

- `config`: print defaults, paths, and provider capabilities.
- `auth login/status/logout`: save a JMComic JWT session without storing plaintext passwords.
- `library favorites`: read authenticated favorites with filters, sorting, and JSON cache.
- `discover`: search by query or tags and return an Agent-friendly shortlist.
- `resolve`: select the best matching item from search results.
- `preview`: download leading pages by JM id, optionally package as PDF.
- `download`: create or execute a download plan by id or query.
- `download --resume-manifest`: resume from an earlier manifest.
- `download --failed-pages-only`: retry only failed pages recorded in a manifest.
- `package`: build ZIP, CBZ, or PDF from an image directory or manifest.

Runtime artifacts are written under a sibling data directory by default:

```text
JM Agent CLI Data/
```

## Build From Source

This package is not available on npm yet. Do not use:

```powershell
npm install -g jm-agent-cli
```

Use the source tree instead:

```powershell
git clone https://github.com/rmtd418/JMComic-Agent-CLI.git
cd JMComic-Agent-CLI
npm install
node .\bin\jm-agent.js config --json
```

Local command link:

```powershell
npm link
jm-agent config --json
```

Local tarball install:

```powershell
npm pack
npm install -g .\jm-agent-cli-0.1.0.tgz
jm-agent config --json
```

## Common Commands

```powershell
jm-agent config --json
jm-agent auth login --provider jm --json
jm-agent auth status --provider jm --json
jm-agent library favorites --provider jm --limit 5 --json
jm-agent discover --provider jm --query love --limit 5 --json
jm-agent resolve --provider jm --query love --limit 3 --json
jm-agent preview --provider jm --id 1429850 --pages 1 --package pdf --json
jm-agent download --provider jm --id 1429850 --execute --page-limit 1 --json
jm-agent package --input "<manifest.json>" --format cbz --format pdf --json
```

## Verification

Offline checks:

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

## Disclaimer

This project is intended for technical research, personal data organization, automation experiments, and lawful backup workflows only. Users are responsible for complying with local laws, platform terms, network access rules, and content regulations.

The project does not host, provide, or distribute comic content. It does not encourage bypassing platform restrictions, copyright infringement, or unlawful use. Content and network access rules may vary by region, and use in mainland China may involve additional compliance risk. Use at your own risk.

The authors and contributors are not responsible for account issues, network issues, legal consequences, data loss, or third-party damages caused by using this tool.

## Acknowledgements

Thanks to these projects and materials:

- [JMComic-Crawler-Python](https://github.com/hect0x7/JMComic-Crawler-Python): reference for JMComic interfaces, download behavior, and ecosystem knowledge.
- [Breeze](https://github.com/deretame/Breeze): reference for JMComic API documentation, data models, and client implementation.

This project includes `tools/vendor/JmComic.bundle.cjs` as the JM request bridge runtime. Before any formal npm publication, its origin, license, and redistribution risk should be reviewed again.

## License

MIT. See [LICENSE](./LICENSE).
