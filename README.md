# JM Agent CLI

面向 AI Agent 的 JMComic npm CLI。这个目录是 `D:\Project\jm\JM Agent CLI` Python 旧项目的 JS/npm 重写版，当前主入口已经切到 Node。

[English README](./README.en.md)

## 定位

- npm 包名：`jm-agent-cli`
- CLI 命令：`jm-agent`
- Node 要求：`>=20`
- 主力 provider：`jm`
- 不迁移：`eh`
- 默认输出：结构化 JSON

## 安装与运行

本地源码运行：

```powershell
npm install
node .\bin\jm-agent.js config --json
```

本地链接成命令：

```powershell
npm link
jm-agent config --json
```

从打包产物安装：

```powershell
npm pack
npm install -g .\jm-agent-cli-0.1.0.tgz
jm-agent config --json
```

公开发布前需要确认 npm 包名可用性，并重新检查 `tools/vendor/JmComic.bundle.cjs` 的来源和许可风险。

## 常用命令

```powershell
jm-agent config --json
jm-agent discover --provider jm --query love --limit 5 --json
jm-agent resolve --provider jm --query love --limit 3 --json
jm-agent preview --provider jm --id 1429850 --pages 1 --package pdf --json
jm-agent download --provider jm --id 1429850 --execute --page-limit 1 --json
jm-agent package --input "<manifest.json>" --format cbz --format pdf --json
```

## 当前能力

- `config`
- `discover`
- `resolve`
- `preview`
- `download`
- `download --execute`
- `package zip/cbz/pdf`
- JM 图片反切片
- manifest 输出
- 结构化 JSON envelope

## 当前边界

- 只支持 `jm`。
- 不支持 `eh`。
- 暂不支持登录与收藏。
- 暂不支持 resume manifest。
- 暂无 resident bridge pool，当前 bridge 在进程内调用 vendor bundle。

## 验证

离线发布前检查：

```powershell
npm run verify
```

在线 JM smoke：

```powershell
npm run smoke:online
```

在线 smoke 会访问 JM 网络服务，适合发布前或改动 bridge/provider 后运行。

## 项目结构

```text
bin/                  CLI 入口
src/commands/         命令处理
src/jm/               JM provider、bridge、下载执行
src/shared/           参数、路径、manifest、JSON envelope
scripts/              检查和验证脚本
test/                 Node 内置 test runner 测试
tools/vendor/         JmComic.bundle.cjs
```

