#!/usr/bin/env node
/**
 * 创建 GitLab Merge Request
 *
 * 环境变量:
 *   GITLAB_URL - GitLab 实例 URL (可选，从 git remote 自动检测)
 *   GITLAB_TOKEN - Personal Access Token
 *   GITLAB_ASSIGNEE - Assignee 用户名 (默认: 当前用户)
 *   GITLAB_REVIEWER - Reviewer 用户名 (默认: Huiming)
 *
 * 参数:
 *   --source <branch> - 源分支 (默认: 当前分支)
 *   --target <branch> - 目标分支 (默认: 自动从源分支推断)
 *   --title <title> - MR 标题 (默认: 使用最新 commit message)
 *   --project <path> - 项目路径 (如: group/project)
 *   --assignee <username> - Assignee 用户名 (覆盖环境变量)
 *   --reviewer <username> - Reviewer 用户名 (覆盖环境变量，多个用逗号分隔)
 *
 * 输出格式: JSON
 */

const { execSync } = require('child_process');
const http = require('http');
const https = require('https');

let GITLAB_URL = process.env.GITLAB_URL;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_ASSIGNEE = process.env.GITLAB_ASSIGNEE || '';
const GITLAB_REVIEWER = process.env.GITLAB_REVIEWER || 'Huiming';

function getHttpProtocol(url) {
  return url.startsWith('https://') ? https : http;
}

function parseGitLabUrl(url) {
  const match = url.match(/^https?:\/\/([^\/:?]+)(?::(\d+))?/);
  if (!match) throw new Error('Invalid GITLAB_URL format');
  return {
    hostname: match[1],
    port: match[2] || (url.startsWith('https://') ? 443 : 80),
    basePath: url.replace(/^https?:\/\/[^\/]+/, '')
  };
}

function gitlabRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const { hostname, port, basePath } = parseGitLabUrl(GITLAB_URL);
    const fullPath = (basePath + path).replace(/\/+/g, '/');
    const protocol = getHttpProtocol(GITLAB_URL);

    const options = {
      hostname,
      port,
      path: fullPath,
      method,
      headers: {
        'PRIVATE-TOKEN': GITLAB_TOKEN,
        'Content-Type': 'application/json'
      }
    };

    const req = protocol.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseData));
          } catch {
            resolve(responseData);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function urlEncode(str) {
  // GitLab API expects slashes to be encoded as %2F, NOT as /
  return encodeURIComponent(str);
}

// 获取当前分支
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error('Failed to get current branch');
  }
}

// 获取 git remote URL
function getGitRemoteUrl() {
  try {
    const url = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    return url;
  } catch (error) {
    throw new Error('Failed to get git remote URL');
  }
}

// 从 git URL 解析项目路径
function parseGitRemoteUrl(gitUrl) {
  // 支持 HTTPS 和 SSH 格式
  // https://gitlab.com/group/project.git
  // git@gitlab.com:group/project.git
  let match;

  if (gitUrl.startsWith('http')) {
    match = gitUrl.match(/^https?:\/\/[^\/]+\/(.+?)(\.git)?$/);
  } else {
    match = gitUrl.match(/^[^@]+@[^:]+:(.+?)(\.git)?$/);
  }

  if (!match) {
    throw new Error(`Unable to parse git URL: ${gitUrl}`);
  }

  return match[1];
}

// 从源分支推断目标分支
function inferTargetBranch(sourceBranch) {
  // 路径规则: 从完整路径提取最后一部分
  // hangxuan/console_TG-8201/SZ_dev -> SZ_dev
  // hangxuan/console_TG-8201/qa-r5-s2 -> qa/r5-s2

  const parts = sourceBranch.split('/');
  const lastPart = parts[parts.length - 1];

  // 处理 qa-r5-s2 -> qa/r5-s2
  if (lastPart.startsWith('qa-')) {
    return `qa/${lastPart.substring(3)}`;
  }

  // 处理其他情况
  return lastPart;
}

// 获取最新的 commit message
function getLatestCommitMessage() {
  try {
    return execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error('Failed to get commit message');
  }
}

// 获取 commit 改动摘要
function getCommitSummary() {
  try {
    const commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim();
    const lines = commitMessage.split('\n');

    // 第一行是标题
    const title = lines[0];

    // 找到空行后的内容作为描述正文
    let bodyStartIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') {
        bodyStartIndex = i + 1;
        break;
      }
    }

    // 提取正文内容
    let body = '';
    if (bodyStartIndex > 0 && bodyStartIndex < lines.length) {
      body = lines.slice(bodyStartIndex).join('\n').trim();
    }

    // 如果有正文，组合标题和正文
    if (body) {
      return title + '\n\n' + body;
    }

    // 如果没有正文，只返回标题
    return title;
  } catch (error) {
    // 如果获取失败，返回 commit message
    return getLatestCommitMessage();
  }
}

// 从分支名中提取 TG 编号
function extractTgNumber(branchName) {
  const match = branchName.match(/TG-(\d+)/i);
  return match ? match[0].toUpperCase() : null;
}

// 根据 commit message 前缀确定类型
function getChangeType(commitMessage) {
  const msg = commitMessage.toLowerCase();

  if (msg.startsWith('fix') || msg.startsWith('bugfix')) {
    return 'Bug Fix';
  } else if (msg.startsWith('feat') || msg.startsWith('feature')) {
    return 'Feature';
  } else if (msg.startsWith('refactor')) {
    return 'Refactoring';
  } else if (msg.startsWith('docs') || msg.startsWith('doc')) {
    return 'Documentation';
  } else if (msg.startsWith('test')) {
    return 'Tests';
  }

  return ''; // 默认不勾选
}

// 生成 MR Description 模板
function generateMRDescription(commitSummary, tgNumber, changeType) {
  const typeOptions = [
    { name: 'Bug Fix', value: changeType === 'Bug Fix' },
    { name: 'Feature', value: changeType === 'Feature' },
    { name: 'Refactoring', value: changeType === 'Refactoring' },
    { name: 'Documentation', value: changeType === 'Documentation' },
    { name: 'Tests', value: changeType === 'Tests' }
  ];

  const checkboxes = typeOptions.map(opt => {
    const checked = opt.value ? 'x' : ' ';
    return `- [${checked}] ${opt.name}`;
  }).join('\n');

  let taigaLink = '';
  if (tgNumber) {
    const isBugOrRefactor = changeType === 'Bug Fix' || changeType === 'Refactoring';
    const issueNum = tgNumber.replace('TG-', '');
    const prefix = isBugOrRefactor ? 'Fixes' : 'Part of';
    const urlType = isBugOrRefactor ? 'issue' : 'task';
    taigaLink = `${prefix} [${tgNumber}](https://taiga.ecquaria.org/project/tecq-agp/${urlType}/${issueNum})`;
  }

  return `## Description of Changes
${commitSummary}

## Type of Change
${checkboxes}

## Taiga Number and link
${taigaLink || '(Please add Taiga link)'}

## Checklist before review
- [x] I have performed a self-review of the code
- [x] No conflict with target branch`;
}

// 获取用户 ID
async function getUserId(username) {
  try {
    const result = await gitlabRequest(`/api/v4/users?username=${username}`, 'GET');
    if (result && result.length > 0) {
      return result[0].id;
    }
    return null;
  } catch (error) {
    console.error(`Warning: Failed to get user ID for ${username}: ${error.message}`);
    return null;
  }
}

// 创建 MR
async function createMR(projectPath, sourceBranch, targetBranch, title, description, assigneeId, reviewerIds) {
  const encodedPath = urlEncode(projectPath);
  const path = `/api/v4/projects/${encodedPath}/merge_requests`;

  const data = {
    source_branch: sourceBranch,
    target_branch: targetBranch,
    title: title,
    description: description
  };

  if (assigneeId) {
    data.assignee_id = assigneeId;
  }

  if (reviewerIds && reviewerIds.length > 0) {
    data.reviewer_ids = reviewerIds;
  }

  return await gitlabRequest(path, 'POST', data);
}

// 从 git URL 中提取 GitLab 基础 URL
function extractGitLabUrlFromRemote(gitUrl) {
  if (gitUrl.startsWith('http')) {
    // https://gitlab.com/group/project.git -> https://gitlab.com
    const match = gitUrl.match(/^(https?:\/\/[^\/]+)/);
    return match ? match[1] : null;
  } else {
    // git@gitlab.com:group/project.git -> https://gitlab.com
    // 需要默认 SSH 对应的 HTTPS URL
    // 这里我们假设 SSH hostname 对应 HTTPS URL
    const match = gitUrl.match(/@([^:]+):/);
    return match ? `https://${match[1]}` : null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let sourceBranch = null;
  let targetBranch = null;
  let title = null;
  let projectPath = null;
  let assigneeOverride = null;
  let reviewerOverride = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      sourceBranch = args[i + 1]; i++;
    } else if (args[i] === '--target' && args[i + 1]) {
      targetBranch = args[i + 1]; i++;
    } else if (args[i] === '--title' && args[i + 1]) {
      title = args[i + 1]; i++;
    } else if (args[i] === '--project' && args[i + 1]) {
      projectPath = args[i + 1]; i++;
    } else if (args[i] === '--assignee' && args[i + 1]) {
      assigneeOverride = args[i + 1]; i++;
    } else if (args[i] === '--reviewer' && args[i + 1]) {
      reviewerOverride = args[i + 1]; i++;
    }
  }

  if (!GITLAB_TOKEN) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing required environment variable: GITLAB_TOKEN'
    }));
    process.exit(1);
  }

  try {
    // 获取源分支
    if (!sourceBranch) {
      sourceBranch = getCurrentBranch();
    }

    // 推断或获取目标分支
    if (!targetBranch) {
      targetBranch = inferTargetBranch(sourceBranch);
    }

    // 获取 git remote URL
    const gitUrl = getGitRemoteUrl();

    // 如果 GITLAB_URL 未设置，从 git remote 自动检测
    if (!GITLAB_URL) {
      GITLAB_URL = extractGitLabUrlFromRemote(gitUrl);
      if (!GITLAB_URL) {
        throw new Error('Unable to detect GITLAB_URL from git remote');
      }
    }

    // 获取项目路径
    if (!projectPath) {
      projectPath = parseGitRemoteUrl(gitUrl);
    }

    // 获取标题
    if (!title) {
      title = getLatestCommitMessage();
    }

    // 获取当前用户 ID
    const currentUser = await gitlabRequest('/api/v4/user', 'GET');

    // 确定 Assignee
    let assigneeId = null;
    const assigneeName = assigneeOverride || GITLAB_ASSIGNEE;
    if (assigneeName) {
      assigneeId = await getUserId(assigneeName);
    }
    // 如果没有指定 assignee，使用当前用户
    if (!assigneeId) {
      assigneeId = currentUser.id;
    }

    // 确定 Reviewer
    const reviewerNames = (reviewerOverride || GITLAB_REVIEWER).split(',').map(s => s.trim()).filter(s => s);
    const reviewerIds = [];
    for (const name of reviewerNames) {
      const id = await getUserId(name);
      if (id) {
        reviewerIds.push(id);
      }
    }

    // 生成 description (使用 commit summary 而不是单纯的 commit message)
    const commitSummary = getCommitSummary();
    const tgNumber = extractTgNumber(sourceBranch);
    const changeType = getChangeType(title);
    const description = generateMRDescription(commitSummary, tgNumber, changeType);

    // 创建 MR
    const result = await createMR(projectPath, sourceBranch, targetBranch, title, description, assigneeId, reviewerIds);

    console.log(JSON.stringify({
      success: true,
      message: 'Merge request created successfully',
      mr: {
        iid: result.iid,
        web_url: result.web_url,
        source_branch: sourceBranch,
        target_branch: targetBranch,
        title: title
      }
    }, null, 2));

  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }));
    process.exit(1);
  }
}

main();
