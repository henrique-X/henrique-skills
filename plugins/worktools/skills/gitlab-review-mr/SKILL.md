---
name: gitlab-review-mr
description: GitLab Merge Request 代码审查与合并。当用户说 "review MR"、"检查我的 MR"、"review gitlab"、"帮我 review 代码"、"review merge request"、"代码审查" 或类似触发词时，自动获取当前用户作为 reviewer 的 GitLab MR，进行代码审查。如果没有问题则直接询问是否 approve 和 merge；如果发现问题则优先发布行内评论，无法解释清楚时才发布总体评论。适用于自托管 GitLab 实例。
---

# GitLab MR Review

自动获取并审查当前用户作为 reviewer 的 GitLab Merge Request。如果代码没有问题，直接询问是否 approve 和 merge；如果发现问题，优先发布行内评论，无法解释清楚时才发布总体评论。

## 环境配置

环境变量从 `~/.bashrc` 加载，首次使用前需要在 `.bashrc` 中配置：

```bash
# GitLab 实例地址（自托管）
export GITLAB_URL="你的GitLab地址"

# Personal Access Token（需要 api, read_api, write_api 权限）
export GITLAB_TOKEN="你的Token"

# 可选：指定用户 ID（默认使用当前 token 对应的用户）
# export GITLAB_USER_ID="123"
```

创建 Personal Access Token：
1. 访问 GitLab → Settings → Access Tokens
2. 权限选择：`api`、`read_api`、`write_api`

配置完成后运行 `source ~/.bashrc` 使环境变量生效。

## 工作流程

当用户请求审查代码时：

1. **获取 MR 列表** - 获取当前用户作为 reviewer 的开放 MR
2. **让用户选择 MR** - 展示 MR 列表，让用户选择要审查的 MR（可多选或选择 all）
3. **获取代码变更** - 获取选中 MR 的 diff
4. **代码审查** - 分析代码变更，识别潜在问题
5. **发布评论**：
   - **如果没有问题** - 发布 "LGTM" 评论
   - **如果发现问题** - 优先发布行内评论，无法解释清楚时才发布总体评论
6. **询问用户** - 询问用户是否 approve 并 merge 这些 MR
7. **执行操作** - 如果用户确认：
   - 先 approve 每个 MR（使用 `approve_mr.cjs`）
   - 再 merge 每个 MR（使用 `merge_mr.cjs`）

## 脚本使用

### 获取 MR 列表（reviewer）

```bash
node "C:\Users\Admin\.claude\skills\gitlab-review-mr\scripts\get_reviewer_mrs.cjs"
```

返回当前用户作为 reviewer 的 MR 列表（JSON 格式）。

### 获取 MR Diff

```bash
node "C:\Users\Admin\.claude\skills\gitlab-review-mr\scripts\get_mr_diff.cjs" --project "group/project" --iid 123
```

返回 MR 的代码变更信息，包括：
- MR 基本信息
- 每个变更文件的 diff
- base_sha、head_sha 用于行内评论

### 发布总体评论

```bash
node "C:\Users\Admin\.claude\skills\gitlab-review-mr\scripts\post_comment.cjs" \
  --project "group/project" \
  --iid 123 \
  --type overall \
  --comment "整体代码看起来不错，有几个小建议..."
```

### 发布行内评论

```bash
node "C:\Users\Admin\.claude\skills\gitlab-review-mr\scripts\post_comment.cjs" \
  --project "group/project" \
  --iid 123 \
  --type inline \
  --file-path "src/utils.js" \
  --line 42 \
  --sha "abc123..." \
  --comment "这里建议使用 const 而非 var"
```

### 批准 MR

```bash
node "C:\Users\Admin\.claude\skills\gitlab-review-mr\scripts\approve_mr.cjs" \
  --project "group/project" \
  --iid 123
```

### 合并 MR

```bash
# 仅合并
node "C:\Users\Admin\.claude\skills\gitlab-review-mr\scripts\merge_mr.cjs" \
  --project "group/project" \
  --iid 123 \
  --message "Merge after review"

# 批准并合并（推荐）
node "C:\Users\Admin\.claude\skills\gitlab-review-mr\scripts\merge_mr.cjs" \
  --project "group/project" \
  --iid 123 \
  --message "Merge after review" \
  --approve
```

## 代码审查要点

进行基础代码审查时，关注：

1. **明显的 Bug** - 逻辑错误、空指针、边界条件
2. **语法问题** - 拼写错误、未定义变量
3. **代码风格** - 命名规范、缩进、格式一致性
4. **安全问题** - 硬编码凭证、未校验输入
5. **简单优化** - 明显的性能改进点

## 代码评论风格

**优先使用行内评论**
- 针对具体代码行的问题，使用行内评论
- 示例：`JSON.parse 可能抛出异常，建议添加 try-catch`

**总体评论的使用场景**
- 需要汇总多个相关问题
- 涉及整体架构或设计问题
- 无法在单行代码中解释清楚的问题

**评论格式**
- 只提出问题或建议，不要总结变更内容
- 使用简单 markdown 语法，不使用图标
- 行内评论内容避免特殊字符（如单引号、花括号），改用简单描述

**没有问题时**
- 发布 "LGTM"

## 执行流程

1. 运行 `get_reviewer_mrs.cjs` 获取 MR 列表
2. 展示 MR 列表给用户，让用户选择要审查的 MR（输入编号如 1,2,3 或 all）
3. 对选中的 MR 运行 `get_mr_diff.cjs` 获取代码变更
4. 分析 diff，生成审查意见：
   - **如果没有问题** → 发布 "LGTM" 评论
   - **如果发现问题** → 优先使用行内评论，无法解释清楚时才使用总体评论
5. 询问用户：是否 approve 并 merge 这些 MR？
6. 如果用户确认：
   - 对每个 MR 运行 `approve_mr.cjs` 进行批准
   - 对每个 MR 运行 `merge_mr.cjs` 进行合并
