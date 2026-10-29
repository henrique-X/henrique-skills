---
name: knowledge-save
description: Extract knowledge from current session and save to structured knowledge base. Use when user says "save knowledge", "记录知识点", "保存到知识库", "总结本次对话", or after completing significant work that contains reusable insights, solutions, or patterns.
---

# Knowledge Save

Extract knowledge from current conversation and save to Markdown knowledge bases.

## Knowledge Base Locations

Two target locations, chosen by content type:

- **Project-specific**: `D:\Workspace\workLog\{project-name}.md` (e.g., `my-marketplace.md`)
- **Topic-general**: `E:\WorkSpace\ai\knowledge\01_raw\inbox\{topic-name}.md` (e.g., `react-patterns.md`, `lowcode.md`)

## Workflow

```
1. Analyze conversation → Extract knowledge points
2. Determine category → Project-specific / Topic-general
3. Save → Append entries to target file
```

## Execution Steps

### Step 1: Analyze Conversation

Scan the current session and identify extractable knowledge:

| Category | What to Extract |
|----------|-----------------|
| File/Code Mapping | Which files were modified, component locations, dependencies |
| Pitfalls & Solutions | Errors encountered, root causes, solutions |
| Architecture | Design decisions, module structure, patterns |
| API & Config | API usage, configuration options, commands |
| Code Patterns | Code comparison, pros/cons, usage scenarios |

### Step 2: Determine Target File

Choose the appropriate file based on content:

- **Project-specific**: knowledge tied to a concrete project's code, files, or setup → `D:\Workspace\workLog\{project-name}.md`
- **Topic-general**: reusable knowledge independent of any single project → `E:\WorkSpace\ai\knowledge\01_raw\inbox\{topic-name}.md`

If unsure, ask the user which category fits best.

### Step 3: Format Knowledge Entry

Use this template for each knowledge point:

```markdown
## {Title}

| 属性 | 值 |
|------|-----|
| 标签 | `#tag1` `#tag2` |
| 来源项目 | {project} |
| 相关文件 | `{file1}`, `{file2}` |
| 创建时间 | {YYYY-MM-DD} |
| 更新时间 | {YYYY-MM-DD} |

### 背景

{Brief context or problem description}

### 内容

{Main knowledge content}

### 代码示例

{Code if applicable}

### 注意事项

{Important notes or gotchas}

---
```

### Step 4: Save to Target File

Append entries to the target file:

1. If the file exists, read it first — skip exact duplicates, update outdated entries (refresh `更新时间`)
2. If the file does not exist, create it with a top-level `# {name}` heading
3. Report a summary of added/updated entries

## Tags Reference

Common tags for categorization:

| Tag | Usage |
|-----|-------|
| `#踩坑` | Errors, pitfalls, gotchas |
| `#解决方案` | Solutions, workarounds |
| `#架构` | Architecture, design |
| `#react` | React-related |
| `#lowcode` | Lowcode platform |
| `#配置` | Configuration |
| `#API` | API usage |
| `#性能` | Performance |
| `#最佳实践` | Best practices |
| `#对比` | Code comparison, pros/cons |

## Example Usage

**User**: "保存知识点"

**Response**:
1. Analyze current conversation
2. Identify 2 knowledge points about Input component binding issues in project `tecq-fe-materials`
3. Determine target: `D:\Workspace\workLog\tecq-fe-materials.md`
4. Append 2 entries using the template
5. Report: "Added 2 entries to tecq-fe-materials.md: Input value binding, Textarea onChange"

## Notes

- Always preserve existing content when appending or updating
- Use user's language (Chinese/English) based on conversation
- Keep entries concise but complete
- Include file paths for easy navigation
