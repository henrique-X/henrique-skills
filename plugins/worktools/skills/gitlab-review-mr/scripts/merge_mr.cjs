#!/usr/bin/env node
/**
 * 合并 GitLab Merge Request
 *
 * 环境变量:
 *   GITLAB_URL - GitLab 实例 URL
 *   GITLAB_TOKEN - Personal Access Token (需要 write_api 权限)
 *
 * 参数:
 *   --project <path> - 项目路径 (如: group/project)
 *   --iid <number> - Merge Request IID
 *   --message <text> - 合并消息 (可选)
 *   --squash - 是否压缩提交 (可选)
 *   --remove-source-branch - 合并后删除源分支 (可选)
 *   --approve - 合并前先批准 MR (可选)
 *
 * 输出格式: JSON
 */

const http = require('http');
const https = require('https');

const GITLAB_URL = process.env.GITLAB_URL;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;

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
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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
  // GitLab API 需要将路径中的 / 编码为 %2F
  return encodeURIComponent(str);
}

// 批准 MR
async function approveMR(projectPath, mrIid, sha = null) {
  const encodedPath = urlEncode(projectPath);
  const path = `/api/v4/projects/${encodedPath}/merge_requests/${mrIid}/approve`;

  const data = {};
  if (sha) {
    data.sha = sha;
  }

  return await gitlabRequest(path, 'POST', data);
}

// 合并 MR
async function mergeMR(projectPath, mrIid, options = {}) {
  const encodedPath = urlEncode(projectPath);
  const path = `/api/v4/projects/${encodedPath}/merge_requests/${mrIid}/merge`;

  const data = {};
  if (options.mergeCommitMessage) {
    data.merge_commit_message = options.mergeCommitMessage;
  }
  if (options.squash) {
    data.squash = true;
  }
  if (options.shouldRemoveSourceBranch) {
    data.should_remove_source_branch = true;
  }

  return await gitlabRequest(path, 'PUT', data);
}

// 检查 MR 是否可以合并
async function checkMRStatus(projectPath, mrIid) {
  const encodedPath = urlEncode(projectPath);
  const path = `/api/v4/projects/${encodedPath}/merge_requests/${mrIid}`;

  const mr = await gitlabRequest(path, 'GET');
  return {
    mergeable: mr.mergeable,
    merge_status: mr.merge_status,
    merge_when_pipeline_succeeds: mr.merge_when_pipeline_succeeds,
    conflicts: mr.has_conflicts,
    pipeline_status: mr.pipeline?.status,
    blocked: mr.blocked,
    draft: mr.draft,
    work_in_progress: mr.work_in_progress
  };
}

async function main() {
  const args = process.argv.slice(2);
  let projectPath = null;
  let mrIid = null;
  let message = null;
  let squash = false;
  let removeSourceBranch = false;
  let shouldApprove = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      projectPath = args[i + 1]; i++;
    } else if (args[i] === '--iid' && args[i + 1]) {
      mrIid = args[i + 1]; i++;
    } else if (args[i] === '--message' && args[i + 1]) {
      message = args[i + 1]; i++;
    } else if (args[i] === '--squash') {
      squash = true;
    } else if (args[i] === '--remove-source-branch') {
      removeSourceBranch = true;
    } else if (args[i] === '--approve') {
      shouldApprove = true;
    }
  }

  if (!projectPath || !mrIid) {
    console.error(JSON.stringify({
      success: false,
      error: 'Usage: node merge_mr.cjs --project <group/project> --iid <mr_iid> [--message <text>] [--squash] [--remove-source-branch] [--approve]'
    }));
    process.exit(1);
  }

  if (!GITLAB_URL || !GITLAB_TOKEN) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing required environment variables: GITLAB_URL and GITLAB_TOKEN'
    }));
    process.exit(1);
  }

  try {
    // 先检查 MR 状态
    const status = await checkMRStatus(projectPath, mrIid);

    if (status.draft || status.work_in_progress) {
      console.log(JSON.stringify({
        success: false,
        message: 'MR is in draft/work-in-progress status and cannot be merged',
        status
      }, null, 2));
      process.exit(1);
    }

    if (status.conflicts) {
      console.log(JSON.stringify({
        success: false,
        message: 'MR has conflicts and cannot be merged',
        status
      }, null, 2));
      process.exit(1);
    }

    if (status.merge_status !== 'can_be_merged') {
      console.log(JSON.stringify({
        success: false,
        message: `MR cannot be merged. Status: ${status.merge_status}`,
        status
      }, null, 2));
      process.exit(1);
    }

    // 如果需要，先批准 MR
    if (shouldApprove) {
      try {
        await approveMR(projectPath, mrIid);
      } catch (error) {
        // 如果已经批准过，忽略错误继续合并
        if (!error.message.includes('has already been approved')) {
          throw error;
        }
      }
    }

    // 执行合并
    const result = await mergeMR(projectPath, mrIid, {
      mergeCommitMessage: message,
      squash,
      shouldRemoveSourceBranch: removeSourceBranch
    });

    console.log(JSON.stringify({
      success: true,
      message: shouldApprove
        ? 'Merge request approved and merged successfully'
        : 'Merge request merged successfully',
      mr: {
        id: result.id,
        iid: result.iid,
        web_url: result.web_url,
        merged_at: result.merged_at
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
