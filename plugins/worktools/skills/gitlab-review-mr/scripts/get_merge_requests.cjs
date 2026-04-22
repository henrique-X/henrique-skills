#!/usr/bin/env node
/**
 * 获取分配给当前用户的 GitLab Merge Requests
 *
 * 环境变量:
 *   GITLAB_URL - GitLab 实例 URL (如: https://gitlab.example.com)
 *   GITLAB_TOKEN - Personal Access Token (需要 api 和 read_api 权限)
 *   GITLAB_USER_ID - 可选，用户 ID。如果不提供则使用当前用户
 *
 * 输出格式: JSON
 */

const http = require('http');
const https = require('https');

// 从环境变量获取配置
const GITLAB_URL = process.env.GITLAB_URL;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_USER_ID = process.env.GITLAB_USER_ID;

// 判断使用 http 还是 https
function getHttpProtocol(url) {
  return url.startsWith('https://') ? https : http;
}

if (!GITLAB_URL || !GITLAB_TOKEN) {
  console.error(JSON.stringify({
    success: false,
    error: 'Missing required environment variables: GITLAB_URL and GITLAB_TOKEN are required'
  }));
  process.exit(1);
}

// 解析 GitLab URL 获取 hostname
function parseGitLabUrl(url) {
  const match = url.match(/^https?:\/\/([^\/:?]+)(?::(\d+))?/);
  if (!match) {
    throw new Error('Invalid GITLAB_URL format');
  }
  return {
    hostname: match[1],
    port: match[2] || (url.startsWith('https://') ? 443 : 80),
    basePath: url.replace(/^https?:\/\/[^\/]+/, '')
  };
}

// 执行 GitLab API 请求
function gitlabRequest(path) {
  return new Promise((resolve, reject) => {
    const { hostname, port, basePath } = parseGitLabUrl(GITLAB_URL);
    const fullPath = (basePath + path).replace(/\/+/g, '/');
    const protocol = getHttpProtocol(GITLAB_URL);

    const options = {
      hostname: hostname,
      port: port,
      path: fullPath,
      method: 'GET',
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
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 获取当前用户信息
async function getCurrentUser() {
  try {
    return await gitlabRequest('/api/v4/user');
  } catch (error) {
    throw new Error(`Failed to get current user: ${error.message}`);
  }
}

// 获取分配给用户的 MR
async function getMergeRequests(assigneeId) {
  try {
    // 获取开放状态且分配给当前用户的 MR
    const path = `/api/v4/merge_requests?assignee_id=${assigneeId}&state=opened&per_page=50`;
    const mrs = await gitlabRequest(path);
    return mrs;
  } catch (error) {
    throw new Error(`Failed to get merge requests: ${error.message}`);
  }
}

// 格式化 MR 输出
function formatMRs(mrs) {
  if (!mrs || mrs.length === 0) {
    return {
      success: true,
      count: 0,
      message: 'No merge requests found assigned to you',
      merge_requests: []
    };
  }

  return {
    success: true,
    count: mrs.length,
    message: `Found ${mrs.length} merge request(s)`,
    merge_requests: mrs.map(mr => ({
      id: mr.id,
      iid: mr.iid,
      project_id: mr.project_id,
      title: mr.title,
      description: mr.description,
      author: mr.author,
      assignees: mr.assignees,
      source_branch: mr.source_branch,
      target_branch: mr.target_branch,
      web_url: mr.web_url,
      created_at: mr.created_at,
      updated_at: mr.updated_at,
      // API 路径用于后续操作
      project_path: mr.references.full.split('/')[0] + '/' + mr.references.full.split('/')[1],
      api_path: `/projects/${mr.project_id}/merge_requests/${mr.iid}`
    }))
  };
}

async function main() {
  try {
    // 确定用户 ID
    let userId = GITLAB_USER_ID;
    if (!userId) {
      const user = await getCurrentUser();
      userId = user.id;
    }

    // 获取 MR 列表
    const mrs = await getMergeRequests(userId);
    const result = formatMRs(mrs);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }));
    process.exit(1);
  }
}

main();
