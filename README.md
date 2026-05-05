# JMComic Agent CLI

面向 AI Agent 和自动化脚本的 JMComic 命令行工具。项目第一次公开发布即为 JS/Node 版本，目标是提供一个可以从源码构建、输出结构化 JSON、方便 Agent 调用的本地 CLI。

[English README](./README.en.md)

## 当前状态

- 包名预留：`jm-agent-cli`
- CLI 命令：`jm-agent`
- 运行环境：Node.js `>=20`
- 支持平台：JMComic
- 当前没有发布到 npm registry
- 当前使用方式：从源码构建或本地 `npm link`

## 功能

- `config`：查看默认参数、数据目录、状态目录和 provider 能力。
- `auth login/status/logout`：登录 JMComic，保存 JWT session，不保存明文密码。
- `library favorites`：读取登录账号的收藏列表，支持过滤、排序和 JSON 缓存。
- `discover`：按关键词或标签搜索，返回适合 Agent 阅读的 shortlist。
- `resolve`：从搜索结果中选择最匹配的一本。
- `preview`：按 JM id 下载前几页预览，可选打包 PDF。
- `download`：按 id 或查询生成下载计划，也可执行下载。
- `download --resume-manifest`：从旧 manifest 恢复下载。
- `download --failed-pages-only`：只重试 manifest 中记录的失败页。
- `package`：将图片目录或 manifest 打包为 ZIP、CBZ、PDF。

默认所有运行产物会写入同级数据目录：

```text
JM Agent CLI Data/
```

包括下载图片、manifest、报告、收藏缓存和登录 session。

## 从源码构建

当前还没有公开 npm 包，因此不要使用：

```powershell
npm install -g jm-agent-cli
```

请从源码安装依赖并运行：

```powershell
git clone https://github.com/rmtd418/JMComic-Agent-CLI.git
cd JMComic-Agent-CLI
npm install
node .\bin\jm-agent.js config --json
```

本地链接为命令：

```powershell
npm link
jm-agent config --json
```

本地打包安装：

```powershell
npm pack
npm install -g .\jm-agent-cli-0.1.0.tgz
jm-agent config --json
```

## AI Skill

仓库提供一个给 AI Agent 使用的英文 skill：

```text
skills/jmcomic-agent-cli/SKILL.md
```

这个 skill 只记录 `jm-agent` 的使用方式、常用命令、参数和注意事项，不提供任何安装方式，也不会打进 npm 包。需要使用时，请把整个 `skills/jmcomic-agent-cli` 文件夹拖到对应 Agent 软件的 skills 目录中。不同 Agent 软件的 skills 目录位置不同，请按你自己的软件规则放置。

## 常用命令

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

## 搜索参数概览

默认 profile 是 `balanced`。

| profile | 搜索页数 | 搜索窗口 | 详情并发 |
|---|---:|---:|---:|
| `fast` | 1 | 80 | 6 |
| `balanced` | 3 | 240 | 12 |
| `deep` | 5 | 400 | 20 |

常用输出参数：

- `--limit`：默认 10，最大 20。
- `--output brief|report|full`：默认 `report`。
- `--chat-limit`：默认 5。
- `--report-limit`：默认 10。
- `--pick best|top|recent|random`：默认 `best`。

## 验证

离线检查：

```powershell
npm run verify
```

在线 JM smoke：

```powershell
npm run smoke:online
```

登录、收藏、下载在线验证：

```powershell
npm run validate:auth-online
npm run validate:favorites-online
npm run validate:download-online
```

在线验证会访问 JMComic 网络服务，请只在你确认网络环境和账号状态可用时运行。

## 免责声明

本项目仅用于技术研究、个人数据整理、自动化工作流实验和合法备份场景。使用者应自行确认所在国家或地区的法律法规、平台服务条款、网络访问规则和内容合规要求。

本项目不提供、托管、分发任何漫画内容，也不鼓励绕过平台限制、传播侵权内容或进行任何违法用途。由于不同地区对相关内容和网络访问的要求差异较大，尤其在中国大陆环境下可能存在额外合规风险，请自行承担使用风险。

项目作者和贡献者不对使用本工具造成的账号风险、网络风险、法律风险、数据损失或第三方损失承担责任。

## 致谢

感谢以下项目和资料提供的参考价值：

- [JMComic-Crawler-Python](https://github.com/hect0x7/JMComic-Crawler-Python)：JMComic 接口、下载流程和相关生态经验的重要参考。
- [Breeze](https://github.com/deretame/Breeze)：JMComic API 文档、数据模型和客户端实现参考。

本项目包含 `tools/vendor/JmComic.bundle.cjs` 作为 JM 请求桥接运行时。后续正式发布 npm 包前，需要继续审查该 vendor bundle 的来源、许可证和再分发风险。

## 许可证

本项目使用 [MIT License](./LICENSE)。
