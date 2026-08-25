---
name: gitlab-create-mr
description: GitLab Merge Request 自动创建工具。当用户说 "创建 MR"、"create MR"、"新建 merge request"、"push mr" 或类似触发词时，自动识别当前项目的远程仓库，根据分支名称推断目标分支并创建 MR。支持路径规则分支命名（如 hangxuan/console_TG-8201/SZ_dev 合并到 SZ_dev），根据 commit message 前缀自动勾选 MR 类型（fix→Bug Fix, feat→Feature）。支持 --with-test 参数，默认上传测试报告到 Taiga，同时自动生成修改报告（基于 git diff）并上传到 Taiga。可通过 --upload-target gitlab 切换回 GitLab 上传。

**重要**：创建 MR 时不要添加 labels，不要在 description 中包含文件修改行数统计。

**前置假设**：运行本 skill 时，用户已完成 commit 并 push 到远程。不要检查、分析或提示本地未提交（uncommitted/unstaged）的代码，直接基于已推送的分支创建 MR。
---

# GitLab Create MR

自动为当前 git 仓库创建 GitLab Merge Request，智能推断目标分支并生成符合规范的 MR 描述。

## 环境配置

首次使用前，需要配置 GitLab Token：

```bash
# Personal Access Token（需要 api, write_api 权限）
export GITLAB_TOKEN="<your-gitlab-token>"

# 可选：指定 GitLab URL（默认从 git remote 自动检测）
# export GITLAB_URL="<your-gitlab-url>"

# 可选：指定默认 Assignee（默认: 当前用户）
# export GITLAB_ASSIGNEE="hangxuan"

# 可选：指定默认 Reviewer（默认: Huiming）
# export GITLAB_REVIEWER="Huiming"

# 可选：Taiga 配置（--upload-target taiga 时必需）
# export TAIGA_URL="<your-taiga-url>"
# export TAIGA_TOKEN="<your-taiga-token>"
# export TAIGA_PROJECT_SLUG="tecq-agp"  # 默认: tecq-agp
```

## 分支命名规则

支持**路径规则**的分支命名，从完整路径自动推断目标分支：

| 源分支 | 目标分支 |
|--------|----------|
| `hangxuan/console_TG-8201/SZ_dev` | `SZ_dev` |
| `hangxuan/console_TG-8201/qa-r5-s2` | `qa/r5-s2` |
| `feature/new-function` | `new-function` |

## Commit Message 规则

MR 类型根据 commit message 前缀自动勾选：

| 前缀 | MR 类型 |
|------|---------|
| `fix:`, `bugfix:` | Bug Fix ✓ |
| `feat:`, `feature:` | Feature ✓ |
| `refactor:` | Refactoring ✓ |
| `docs:`, `doc:` | Documentation ✓ |
| `test:` | Tests ✓ |
| 其他 | 无默认选中 |

## 使用方法

**重要**：本 skill 以插件形式安装，脚本路径随版本变化。执行前必须先用 Glob 定位脚本：

```
Glob: **/worktools/*/skills/gitlab-create-mr/scripts/create_mr.cjs
```
在 `~/.claude/plugins/cache/` 目录下搜索，找到实际路径后执行。

### 基本用法（推荐）

在 git 仓库目录中：

```bash
node "<通过 Glob 找到的实际路径>"
```

脚本会自动：
1. 检测当前分支
2. 从 git remote 获取项目路径
3. 推断目标分支
4. 使用最新 commit message 作为标题
5. 生成 MR description 模板（包含 commit 改动摘要）
6. 设置 Assignee 为当前用户
7. 设置 Reviewer 为 @Huiming
8. 创建 MR

### 指定参数

```bash
# 指定源分支和目标分支
node "<通过 Glob 找到的实际路径>" \
  --source "feature/new-function" \
  --target "develop"

# 指定标题
node "<通过 Glob 找到的实际路径>" \
  --title "Custom MR Title"

# 指定项目路径
node "<通过 Glob 找到的实际路径>" \
  --project "group/project"

# 指定 Assignee
node "<通过 Glob 找到的实际路径>" \
  --assignee "username"

# 指定 Reviewer（支持多个，用逗号分隔）
node "<通过 Glob 找到的实际路径>" \
  --reviewer "reviewer1,reviewer2"
```

### 附带测试报告（推荐）

```bash
node "<通过 Glob 找到的实际路径>" --with-test
```

使用 `--with-test` 时，脚本会：
1. 上传 `--test-report` 指定的测试报告到 Taiga（默认）或 GitLab
2. 将测试报告链接追加到 MR description 的 `## Test Report` 章节
3. 自动生成修改报告（包含提交记录、文件变更统计、diff 摘要），上传到 Taiga 并追加到 MR description 的 `## Change Report` 章节

```bash
# 默认上传到 Taiga（自动同时生成修改报告）
node "<通过 Glob 找到的实际路径>" \
  --with-test \
  --test-report "D:\Workspace\kaizen\test-case\projectName\TG-1234.md"

# 切换回 GitLab 上传（不生成修改报告）
node "<通过 Glob 找到的实际路径>" \
  --with-test \
  --test-report "D:\Workspace\kaizen\test-case\projectName\TG-1234.md" \
  --upload-target gitlab
```

## 带 --with-test 的完整工作流

当用户使用 `--with-test` 参数时，需要先生成测试报告再创建 MR。执行顺序：

### 第一步：提取关键字

从当前分支名提取 `TG-XXX` 编号（如 `hangxuan/console_TG-9537/SZ_dev` → `TG-9537`）。

### 第二步：生成测试报告

按照 testcase-generator 的分析流程，对 TG-XXX 相关的提交进行分析并生成测试报告。

具体步骤：
1. `git log --all --oneline --no-merges --grep="<TG-XXX>"` 查找提交记录
2. `git show <hash> --stat` 查看变更范围
3. `git diff <hash>^..<hash>` 查看具体 diff
4. 追踪调用链上下文（关键标识符的上下游）
5. 按核心功能、边界异常、回归影响三个维度生成测试内容
6. 输出 Markdown 格式报告

详细流程参见 testcase-generator 的 SKILL.md。

### 第三步：保存报告

将生成的测试报告保存到本地：
```
D:\Workspace\kaizen\test-case\${projectName}\${TG-XXX}.md
```
- `projectName`：从 git remote URL 解析，取最后两级路径（如 `group/project`）
- 如果目录不存在，自动创建

### 第四步：创建 MR 并上传报告

执行 `create_mr.cjs`，传入测试报告路径：
```bash
node "<path>/create_mr.cjs" --with-test --test-report "D:\Workspace\kaizen\test-case\${projectName}\${TG-XXX}.md"
```

脚本会自动：
1. 上传测试报告到 Taiga（默认）
2. 自动生成修改报告（git diff）并上传到 Taiga
3. 将两个报告链接追加到 MR description
3. 创建 MR

## MR Description 模板

自动生成的 MR description 包含：

```
## Description of Changes
[commit 标题]

[commit 正文描述，例如：
Add GPG key management functionality for secure Git operations
Implement GPG key encryption/decryption with passphrase support
Add UI components for creating and editing GPG keys]

## Type of Change
- [ ] Bug Fix
- [x] Feature
- [ ] Refactoring
- [ ] Documentation
- [ ] Tests

## Taiga Number and link
Fixes [TG-XXX](https://taiga.ecquaria.org/project/tecq-agp/issue/XXX)
或 Part of [TG-XXX](https://taiga.ecquaria.org/project/tecq-agp/task/XXX)

## Checklist before review
- [x] I have performed a self-review of the code
- [x] No conflict with target branch
```

**自动设置**：
- **Assignee**: 当前用户（从 GitLab Token 自动识别，可通过环境变量或参数覆盖）
- **Reviewer**: Huiming（可通过环境变量或参数覆盖，支持多个）

**TG 编号提取**：从分支名中自动提取 `TG-XXX` 编号

**Taiga 链接类型**：
- Bug Fix / Refactoring → `Fixes [TG-XXX](...issue/...)`
- Feature → `Part of [TG-XXX](...task/...)`

**重要限制**：
- **不添加 Labels**：MR 创建时不会自动添加任何标签（labels），需要手动在 GitLab UI 中添加
- **不包含文件修改行数**：MR description 中不包含文件修改统计（如 "+100/-50"），保持描述简洁

## 执行流程

1. 确保在 git 仓库目录中（代码已 commit 并 push，无需检查本地未提交代码）
2. 运行脚本
3. 获取创建的 MR URL
