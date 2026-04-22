#!/usr/bin/env node
/**
 * 获取当前用户作为 reviewer 的 GitLab Merge Requests
 *
 * 环境变量:
 *   GITLAB_URL - GitLab 实例 URL
 *   GITLAB_TOKEN - Personal Access Token
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

function gitlabRequest(path, method = 'GET') {
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

async function getCurrentUser() {
  try {
    return await gitlabRequest('/api/v4/user');
  } catch (error) {
    throw new Error(`Failed to get current user: ${error.message}`);
  }
}

async function getAllProjects() {
  try {
    // 使用 min_access_level=30 获取用户有开发权限及以上权限的项目
    // 这样能获取更多项目，包括通过 group 权限访问的
    const projects = await gitlabRequest('/api/v4/projects?min_access_level=30&per_page=100&order_by=id&sort=asc');
    return projects || [];
  } catch (error) {
    // 如果 min_access_level 不支持，回退到 membership=true
    return await gitlabRequest('/api/v4/projects?membership=true&per_page=100');
  }
}

async function getMRsAsReviewer(reviewerId) {
  try {
    const projects = await getAllProjects();

    let allMRs = [];
    for (const project of projects) {
      try {
        // 获取项目的所有 opened MR
        const mrs = await gitlabRequest(`/api/v4/projects/${project.id}/merge_requests?state=opened&per_page=100`);
        if (mrs && mrs.length > 0) {
          // 筛选出用户作为 reviewer 的 MR（排除自己创建的）
          const myReviewerMrs = mrs.filter(mr => {
            // 排除自己创建的 MR
            if (mr.author.id === reviewerId) return false;
            // 检查用户是否在 reviewers 列表中
            if (!mr.reviewers || mr.reviewers.length === 0) return false;
            return mr.reviewers.some(r => r.id === reviewerId);
          });
          if (myReviewerMrs.length > 0) {
            allMRs = allMRs.concat(myReviewerMrs);
          }
        }
      } catch (err) {
        // 忽略单个项目的错误，继续查询其他项目
      }
    }

    return allMRs;
  } catch (error) {
    throw new Error(`Failed to get MRs as reviewer: ${error.message}`);
  }
}

function formatMRs(mrs) {
  if (!mrs || mrs.length === 0) {
    return {
      success: true,
      count: 0,
      message: '没有需要 review 的 MR',
      merge_requests: []
    };
  }

  return {
    success: true,
    count: mrs.length,
    message: `找到 ${mrs.length} 个需要 review 的 MR`,
    merge_requests: mrs.map(mr => ({
      id: mr.id,
      iid: mr.iid,
      project_id: mr.project_id,
      title: mr.title,
      description: mr.description,
      author: mr.author,
      reviewers: mr.reviewers,
      source_branch: mr.source_branch,
      target_branch: mr.target_branch,
      web_url: mr.web_url,
      created_at: mr.created_at,
      updated_at: mr.updated_at,
      project_path: mr.references?.full?.split('/').slice(0, 2).join('/') || `${mr.project_id}`,
      api_path: `/projects/${mr.project_id}/merge_requests/${mr.iid}`
    }))
  };
}

async function main() {
  try {
    const user = await getCurrentUser();
    const mrs = await getMRsAsReviewer(user.id);
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
