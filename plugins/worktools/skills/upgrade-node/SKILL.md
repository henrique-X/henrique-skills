---
name: upgrade-node
description: 用 nvm-windows 将前端项目的 Node 版本升级到用户指定的版本。全流程：更新 .nvmrc 与 package.json engines 两处版本声明 → nvm 安装切换 → 重装依赖 → 按项目已有脚本验证（build/test/类型检查/lint，有啥跑啥）→ 输出报告。当用户要求"升级 Node 版本"、"切换 Node"、"项目升到 Node X"时使用。
---

# 升级项目 Node 版本

## 概述

将项目升级到用户指定的 Node 版本：只改核心两处版本声明（`.nvmrc` 与 `package.json` 的 `engines`），用 nvm-windows 安装并切换 Node，重装依赖，然后运行项目已有脚本做全流程验证，最后输出报告。

硬性约束：

- **目标版本必须来自用户**。用户没有明确说版本号时，先用提问工具询问，绝不自行猜测或默认选 LTS。
- **只改 `.nvmrc` 和 `package.json` 的 `engines`**。CI（如 `.gitlab-ci.yml` 的 image）、Dockerfile、`.node-version`、`volta` 字段等其他位置的版本差异，只在最终报告中提醒，一律不修改。
- **不自动 git 提交**。改动留在工作区，由用户检查后自行提交。

## 工作流程

### 第 1 步：环境与现状检查

1. `nvm version` 确认 nvm-windows 可用；不可用则报告并停止，不要尝试其他安装方式。
2. `nvm list` 查看已装版本；目标版本已在列则第 2 步跳过安装。
3. 读 `package.json`：`engines.node`、`packageManager` 字段；看项目根目录是否已有 `.nvmrc`。
4. `node -v` 记录当前版本。
5. 扫描其他位置的 Node 版本（`.gitlab-ci.yml` 的 image、`Dockerfile` 的 FROM、`.node-version`、`engines` 之外的 volta 配置），仅记录，供第 6 步报告使用。

### 第 2 步：安装并切换 Node

1. 目标版本未安装时执行 `nvm install <版本号>`。
2. 执行切换前，必须告知用户：**nvm-windows 是整台机器全局切换**，切换后所有项目都会用新版本；若有其他项目依赖旧版本 Node，完成后需要手动切回。告知后再执行 `nvm use <版本号>`。
3. `node -v` 确认已切换到目标版本。

### 第 3 步：更新核心两处

1. `.nvmrc`：存在 → 内容更新为新版本号；不存在 → 不创建。
2. `package.json` 的 `engines.node`：沿用项目现有写法风格，只改数值：
   - `>=X.Y.Z <N` 风格（如 `>=22.22.3 <25`）→ 下界改为目标版本，上界改为目标大版本 +1（如升到 `24.10.0` → `>=24.10.0 <25`）。
   - `^`、`~`、`=` 等其他风格 → 保持原前缀，更新版本数值。
   - 项目没有 `engines` 字段 → 询问用户是否要添加，不要擅自添加。

### 第 4 步：重装依赖

按 `packageManager` 字段判定包管理器；无该字段时用 npm：

- `yarn@4` 及以上（Berry）→ `yarn install`；若 yarn 不可用先 `corepack enable`。
- `yarn@1` → `yarn install`。
- `pnpm` → `pnpm install`。

在原 `node_modules` 上直接重装。安装失败且报错指向旧缓存/旧产物时，先向用户说明，再清空 `node_modules` 重装。不手动编辑 lock 文件。

### 第 5 步：验证（有啥跑啥）

读 `package.json` 的 `scripts`，按顺序检查以下脚本，**存在即运行，失败即停**：

1. `build`
2. `test`
3. 类型检查：`check:types` / `typecheck`（都没有但有 tsc 依赖时，跑 `tsc --noEmit`）
4. `lint`

规则：

- 脚本不存在 = 该项跳过，不是错误。
- 每项记录结果：通过 / 失败 / 跳过。
- 若项目一个验证脚本都没有，至少确认 `node -v` 正确、依赖安装成功，并在报告中说明"项目未定义验证脚本"。
- 验证失败时：摘要报错，判断是否与 Node 版本升级相关（如依赖不支持新 Node、原生模块需重编译），在报告中给出可能原因和下一步建议；**不要擅自改业务代码来修错，也不要擅自降级版本**。

### 第 6 步：输出报告

1. 版本对照：升级前后的 `node -v`、`engines.node`、`.nvmrc`。
2. 改动文件清单（通常为 `.nvmrc`、`package.json`、lock 文件的自动更新）。
3. 验证结果表：build / test / 类型检查 / lint 各自的 通过 / 失败 / 跳过，及失败项的错误摘要与建议。
4. 其他位置版本不一致提醒：列出第 1 步扫描到的 CI、Dockerfile 等仍指向旧版本的文件，提醒用户自行决定是否更新。
5. 提醒：改动未提交，由用户检查后自行 git 提交；nvm-windows 全局已切换，其他项目若需旧版本需手动 `nvm use` 切回。
