# Claude Code Plugin Marketplace

个人 Claude Code 技能插件仓库。

## 插件列表

### worktools - 工作流技能包

包含以下技能：

- **code-review** - 前端代码审查
- **daily-report** - 每日工作日报生成
- **knowledge-save** - 知识点保存到知识库
- **gitlab-review-mr** - GitLab Merge Request 代码审查与合并
- **gitlab-create-mr** - GitLab Merge Request 创建（支持 `--with-test` 附带测试报告）
- **testcase-generator** - 根据 git commit 关键字生成测试分析报告
- **optimize-claude-md** - 拆分优化 CLAUDE.md，将根目录文件拆分为模块化规则文件并提升加载优先级

## 安装

在 Claude Code 中添加此 marketplace：

```bash
/plugins add --marketplace https://github.com/henrique-X/henrique-skills
```

## 作者

henrique
