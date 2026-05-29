# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Claude Code 个人技能插件 marketplace，包含一个名为 `worktools` 的插件包，内含 7 个工作流技能。

## 没有构建系统

本项目无 package.json、无依赖、无构建流程。所有脚本都是自包含的：

- `.cjs` 脚本：纯 Node.js 内置模块（`http`、`https`、`fs`、`path`、`child_process`），无第三方依赖
- `.py` 脚本：Python 标准库模块

脚本直接通过 `node <script>.cjs` 或 `python3 <script>.py` 执行。

## 项目结构

```
plugins/worktools/
├── .claude-plugin/plugin.json   # 插件元数据（name, version）
└── skills/
    ├── code-review/             # 前端代码审查（SKILL.md + references/）
    ├── daily-report/            # 日报生成（SKILL.md + scripts/collect_git_stats.py）
    ├── gitlab-review-mr/        # GitLab MR 审查合并（SKILL.md + scripts/*.cjs）
    ├── gitlab-create-mr/        # GitLab MR 创建（SKILL.md + scripts/create_mr.cjs）
    ├── knowledge-save/          # 知识保存（SKILL.md）
    ├── testcase-generator/      # 测试用例生成（SKILL.md）
    └── optimize-claude-md/      # CLAUDE.md 拆分优化（SKILL.md）
```

Marketplace 注册在 `.claude-plugin/marketplace.json`，插件定义在 `plugins/worktools/.claude-plugin/plugin.json`。

## 技能定义约定

每个技能包含一个 `SKILL.md`，YAML frontmatter 定义 `name` 和 `description`。可选 `references/` 目录放参考文档，`scripts/` 目录放辅助脚本。

## GitLab API 脚本模式

所有 `.cjs` 脚本共享以下模式：

- 环境变量：`GITLAB_URL`（自托管 GitLab 地址）、`GITLAB_TOKEN`（认证 token）
- HTTP 请求：直接用 Node.js 内置 `http`/`https` 模块，无封装库
- 项目路径：用 `encodeURIComponent` 编码（路径中的 `/` 要转为 `%2F`）
- 参数解析：手动 `process.argv` 迭代，无参数解析库

## 关键脚本

- `create_mr.cjs`：最复杂的脚本。自动检测分支、推断目标分支（路径式分支命名如 `hangxuan/console_TG-8201/SZ_dev` → `SZ_dev`）、解析 conventional commit 前缀确定 MR 类型、关联 Taiga 工单、可选上传测试报告
- `post_comment.cjs`：支持 MR 整体评论和基于 diff 行号的内联评论
- `merge_mr.cjs`：合并前校验（draft 状态、冲突、可合并性）

## 版本管理

插件版本号在 `plugins/worktools/.claude-plugin/plugin.json` 的 `version` 字段。修改技能后需要 bump 版本号。
