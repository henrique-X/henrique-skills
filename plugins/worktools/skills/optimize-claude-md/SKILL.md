---
name: optimize-claude-md
description: Optimize a project's CLAUDE.md by splitting content into modular rule files, moving it to higher-priority locations, and using @import references. Use after /init generates a root CLAUDE.md, or anytime CLAUDE.md grows too large.
---

# Optimize CLAUDE.md

将项目根目录下由 `/init` 生成的 CLAUDE.md 进行拆分优化，提升可维护性和加载优先级。

## 背景知识

### CLAUDE.md 的 11 个加载位置与优先级

优先级从低到高（后加载 = 高优先级）：

| 层级 | 位置 | 说明 |
|------|------|------|
| 组织级 | 组织配置目录/CLAUDE.md | 全公司通用 |
| 组织级 | 组织配置目录/.claude/CLAUDE.md | 全公司通用 |
| 组织级 | 组织配置目录/.claude/rules/*.md | 全公司通用 |
| 用户级 | ~/.claude/CLAUDE.md | 个人通用 |
| 用户级 | ~/.claude/rules/*.md | 个人通用 |
| 项目级 | /项目根/CLAUDE.md | 项目级，最低优先 |
| 项目级 | /项目根/.claude/CLAUDE.md | 项目级，高于根目录 |
| 项目级 | /项目根/.claude/rules/*.md | 项目级，**同层级最高** |
| 项目级 | /项目根/src/rules/*.md | 按目录作用域 |
| 项目级 | /项目根/src/main/CLAUDE.md | 按目录作用域 |
| 本地级 | /项目根/src/main/CLAUDE.local.md | **绝对最高优先级** |

关键规则：
- 所有文件是**叠加关系**，不是覆盖
- 同层级中 `.claude/rules/*.md` > `.claude/CLAUDE.md` > 根目录 CLAUDE.md
- `CLAUDE.local.md` 在同目录中优先级最高
- @import 递归深度上限 5 层
- 单文件字符上限 40000（超限仍加载但被标记为 large）
- `<!-- HTML注释 -->` 在加载时被自动剥离，可用于隐藏给开发者看的注释

## 执行步骤

### 第一步：读取并分析现有 CLAUDE.md

读取项目根目录的 CLAUDE.md，识别以下内容类别：

1. **项目概述** — 项目是什么、做什么、技术栈
2. **构建/测试命令** — 如何 build、test、lint、run
3. **架构说明** — 目录结构、模块关系、数据流
4. **编码规范** — 命名、风格、Git 提交规范
5. **工作流** — PR 流程、部署流程、分支策略
6. **踩坑记录** — 已知问题、注意事项、历史教训
7. **工具配置** — 编辑器、lint 规则、环境变量

### 第二步：识别项目类型与通用引用

**所有项目**必须添加 karpathy-skills 规范引用。通过检查项目中是否存在以下文件来判断是否为 **React 项目**：
- `package.json` 中包含 `react` 依赖
- 存在 `.jsx` / `.tsx` 文件
- 存在 `next.config.js` / `next.config.mjs`
- 存在 `vite.config.js` / `vite.config.ts`（搭配 React）

React 项目额外添加 vercel-react-best-practices 引用。

告诉用户你识别到的项目类型和将要添加的引用。

### 第三步：确认用户意图

告诉用户你识别到了哪些内容类别，并提出拆分方案。询问：
- 是否有想调整的分类？
- 是否需要创建 `CLAUDE.local.md`？（用于本地环境配置，不会被提交）
- 拆分后的目录偏好：`.claude/rules/` 还是 `src/rules/`？

### 第四步：创建拆分文件

根据确认的方案执行。典型的文件拆分模式：

```
项目根/
├── CLAUDE.md                         # 精简索引，仅包含 @import 引用（目标 < 50行）
└── .claude/
    ├── CLAUDE.md                     # 可选，项目级补充说明
    ├── CLAUDE.local.md               # 可选，本地环境配置（不提交）
    └── rules/
        ├── karpathy-skills.md        # 通用编码规范（所有项目必加）
        ├── vercel-react-best-practices.md  # React 项目必加
        ├── project-overview.md       # 项目概述
        ├── architecture.md           # 架构说明
        ├── build-commands.md         # 构建与测试命令
        ├── coding-standards.md       # 编码规范
        ├── workflow.md               # 工作流
        └── gotchas.md                # 踩坑记录
```

**根目录 CLAUDE.md 优化后的样子（非 React 项目）：**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 项目概述
@.claude/rules/project-overview.md

# 架构说明
@.claude/rules/architecture.md

# 构建与测试
@.claude/rules/build-commands.md

# 编码规范
@.claude/rules/coding-standards.md

# andrej-karpathy-skills 规范
@.claude/rules/karpathy-skills.md

# 工作流
@.claude/rules/workflow.md

# 踩坑记录
@.claude/rules/gotchas.md
```

**React 项目额外添加：**

```markdown
# vercel-react-best-practices React实践Skills
@.claude/rules/vercel-react-best-practices.md
```

**拆分文件的规范：**
- 每个文件专注一个主题，保持精简
- 不在拆分文件中重复写 `# CLAUDE.md` 标题
- 如果某个类别内容很少（< 10行），合并到相邻类别而不是单独一个文件
- 文件命名使用 kebab-case

### 第五步：创建 .claude 目录并写入文件

1. 检查 `.claude/` 目录是否存在，不存在则创建
2. 检查 `.gitignore`：确保 `.claude/CLAUDE.md` 和 `.claude/rules/*.md` **不被忽略**（这些应该被提交）。但 `CLAUDE.local.md` 应该被忽略
3. 写入所有拆分后的文件
4. 重写根目录的 CLAUDE.md 为精简索引

### 第六步：验证

- 确认根目录 CLAUDE.md 行数 < 50 行
- 确认所有 @import 引用的文件都存在
- 确认 .gitignore 配置正确（CLAUDE.local.md 被忽略，rules 文件不被忽略）
- 确认 karpathy-skills.md 已创建（所有项目）
- 确认 vercel-react-best-practices.md 已创建（仅 React 项目）
- 确认总字符数未超过 40000 限制

## 优化原则

1. **根目录 CLAUDE.md 越短越好** — 它只是索引，不是内容仓库
2. **每个 .md 文件只讲一件事** — 便于维护和理解
3. **利用 .claude/rules/ 的高优先级** — 同层级中优先级最高的项目级位置
4. **CLAUDE.local.md 放敏感/本地配置** — 如数据库连接、本地端口等，确保 .gitignore 中
5. **不自动清理原有内容** — 先备份再修改，确认无误后删除旧内容

## 附录：通用引用文件模板

以下文件内容直接写入 `.claude/rules/` 目录，不要修改其中内容。

### 模板 A：karpathy-skills.md（所有项目必加）

````markdown
# Karpathy Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
````

### 模板 B：vercel-react-best-practices.md（仅 React 项目）

````markdown
# Vercel React Best Practices

Comprehensive performance optimization guide for React and Next.js applications, maintained by Vercel. Contains 70 rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:
- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React/Next.js code
- Optimizing bundle size or load times

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Eliminating Waterfalls | CRITICAL | `async-` |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` |
| 3 | Server-Side Performance | HIGH | `server-` |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH | `client-` |
| 5 | Re-render Optimization | MEDIUM | `rerender-` |
| 6 | Rendering Performance | MEDIUM | `rendering-` |
| 7 | JavaScript Performance | LOW-MEDIUM | `js-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

## Quick Reference

### 1. Eliminating Waterfalls (CRITICAL)

- `async-cheap-condition-before-await` - Check cheap sync conditions before awaiting flags or remote values
- `async-defer-await` - Move await into branches where actually used
- `async-parallel` - Use Promise.all() for independent operations
- `async-dependencies` - Use better-all for partial dependencies
- `async-api-routes` - Start promises early, await late in API routes
- `async-suspense-boundaries` - Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)

- `bundle-barrel-imports` - Import directly, avoid barrel files
- `bundle-analyzable-paths` - Prefer statically analyzable import and file-system paths to avoid broad bundles and traces
- `bundle-dynamic-imports` - Use next/dynamic for heavy components
- `bundle-defer-third-party` - Load analytics/logging after hydration
- `bundle-conditional` - Load modules only when feature is activated
- `bundle-preload` - Preload on hover/focus for perceived speed

### 3. Server-Side Performance (HIGH)

- `server-auth-actions` - Authenticate server actions like API routes
- `server-cache-react` - Use React.cache() for per-request deduplication
- `server-cache-lru` - Use LRU cache for cross-request caching
- `server-dedup-props` - Avoid duplicate serialization in RSC props
- `server-hoist-static-io` - Hoist static I/O (fonts, logos) to module level
- `server-no-shared-module-state` - Avoid module-level mutable request state in RSC/SSR
- `server-serialization` - Minimize data passed to client components
- `server-parallel-fetching` - Restructure components to parallelize fetches
- `server-parallel-nested-fetching` - Chain nested fetches per item in Promise.all
- `server-after-nonblocking` - Use after() for non-blocking operations

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- `client-swr-dedup` - Use SWR for automatic request deduplication
- `client-event-listeners` - Deduplicate global event listeners
- `client-passive-event-listeners` - Use passive listeners for scroll
- `client-localstorage-schema` - Version and minimize localStorage data

### 5. Re-render Optimization (MEDIUM)

- `rerender-defer-reads` - Don't subscribe to state only used in callbacks
- `rerender-memo` - Extract expensive work into memoized components
- `rerender-memo-with-default-value` - Hoist default non-primitive props
- `rerender-dependencies` - Use primitive dependencies in effects
- `rerender-derived-state` - Subscribe to derived booleans, not raw values
- `rerender-derived-state-no-effect` - Derive state during render, not effects
- `rerender-functional-setstate` - Use functional setState for stable callbacks
- `rerender-lazy-state-init` - Pass function to useState for expensive values
- `rerender-simple-expression-in-memo` - Avoid memo for simple primitives
- `rerender-split-combined-hooks` - Split hooks with independent dependencies
- `rerender-move-effect-to-event` - Put interaction logic in event handlers
- `rerender-transitions` - Use startTransition for non-urgent updates
- `rerender-use-deferred-value` - Defer expensive renders to keep input responsive
- `rerender-use-ref-transient-values` - Use refs for transient frequent values
- `rerender-no-inline-components` - Don't define components inside components

### 6. Rendering Performance (MEDIUM)

- `rendering-animate-svg-wrapper` - Animate div wrapper, not SVG element
- `rendering-content-visibility` - Use content-visibility for long lists
- `rendering-hoist-jsx` - Extract static JSX outside components
- `rendering-svg-precision` - Reduce SVG coordinate precision
- `rendering-hydration-no-flicker` - Use inline script for client-only data
- `rendering-hydration-suppress-warning` - Suppress expected mismatches
- `rendering-activity` - Use Activity component for show/hide
- `rendering-conditional-render` - Use ternary, not && for conditionals
- `rendering-usetransition-loading` - Prefer useTransition for loading state
- `rendering-resource-hints` - Use React DOM resource hints for preloading
- `rendering-script-defer-async` - Use defer or async on script tags

### 7. JavaScript Performance (LOW-MEDIUM)

- `js-batch-dom-css` - Group CSS changes via classes or cssText
- `js-index-maps` - Build Map for repeated lookups
- `js-cache-property-access` - Cache object properties in loops
- `js-cache-function-results` - Cache function results in module-level Map
- `js-cache-storage` - Cache localStorage/sessionStorage reads
- `js-combine-iterations` - Combine multiple filter/map into one loop
- `js-length-check-first` - Check array length before expensive comparison
- `js-early-exit` - Return early from functions
- `js-hoist-regexp` - Hoist RegExp creation outside loops
- `js-min-max-loop` - Use loop for min/max instead of sort
- `js-set-map-lookups` - Use Set/Map for O(1) lookups
- `js-tosorted-immutable` - Use toSorted() for immutability
- `js-flatmap-filter` - Use flatMap to map and filter in one pass
- `js-request-idle-callback` - Defer non-critical work to browser idle time

### 8. Advanced Patterns (LOW)

- `advanced-effect-event-deps` - Don't put `useEffectEvent` results in effect deps
- `advanced-event-handler-refs` - Store event handlers in refs
- `advanced-init-once` - Initialize app once per app load
- `advanced-use-latest` - useLatest for stable callback refs

## Full Compiled Document

For the complete guide with all rules expanded, see the AGENTS.md in the original repository: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
````
