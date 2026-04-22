---
name: knowledge-save
description: Extract knowledge from current session and save to structured knowledge base. Use when user says "save knowledge", "记录知识点", "保存到知识库", "总结本次对话", or after completing significant work that contains reusable insights, solutions, or patterns.
---

# Knowledge Save

Extract knowledge from current conversation and save to a structured Markdown knowledge base.

## Knowledge Base Location

All knowledge files are stored in: `D:\Typora\workspace\work\reference\`

## Workflow

```
1. Analyze conversation → Extract knowledge points
2. Determine category → Project / Topic / Quick Reference
3. Read existing file → Check for duplicates or updates
4. Smart merge → Dedupe, update outdated info, append new content
5. Update index → Refresh INDEX.md
6. Report → Summary of added/updated content
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

- **Project-specific**: `projects/{project-name}.md` (e.g., `tecq-fe-materials.md`)
- **Topic-general**: `topics/{topic-name}.md` (e.g., `react-patterns.md`, `lowcode.md`)
- **Quick reference**: `quick-ref/{type}.md` (e.g., `commands.md`, `apis.md`)

If unsure, ask the user which category fits best.

### Step 3: Read Existing Content

Before writing, read the target file to:
- Check if similar knowledge already exists
- Identify outdated information to update
- Find the right section to append

### Step 4: Format Knowledge Entry

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

### Step 5: Smart Merge Strategy

When merging with existing content:

1. **Exact duplicate** → Skip, do not add
2. **Similar but outdated** → Update the existing entry, refresh `更新时间`
3. **New content** → Append to appropriate section
4. **Contradictory info** → Keep both with notes, or ask user

### Step 6: Update Index

After modifying any file, update `INDEX.md`:

1. Update "最近更新" section with new entry
2. Update tag counts if new tags added
3. Update project list if new project file created

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
2. Identify 2 knowledge points about Input component binding issues
3. Determine target: `projects/tecq-fe-materials.md`
4. Read existing file
5. Merge new entries
6. Update INDEX.md
7. Report: "Added 2 entries to tecq-fe-materials.md: Input value binding, Textarea onChange"

## Notes

- Always preserve existing content when merging
- Use user's language (Chinese/English) based on conversation
- Keep entries concise but complete
- Include file paths for easy navigation
