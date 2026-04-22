#!/usr/bin/env node
/**
 * 批准 GitLab Merge Request
 *
 * 环境变量:
 *   GITLAB_URL - GitLab 实例 URL
 *   GITLAB_TOKEN - Personal Access Token (需要 api 权限)
 *
 * 参数:
 *   --project <path> - 项目路径 (如: group/project)
 *   --iid <number> - Merge Request IID
 *   --sha <string> - MR 的 HEAD SHA (可选，用于确保 MR 未被修改)
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

async function main() {
  const args = process.argv.slice(2);
  let projectPath = null;
  let mrIid = null;
  let sha = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      projectPath = args[i + 1]; i++;
    } else if (args[i] === '--iid' && args[i + 1]) {
      mrIid = args[i + 1]; i++;
    } else if (args[i] === '--sha' && args[i + 1]) {
      sha = args[i + 1]; i++;
    }
  }

  if (!projectPath || !mrIid) {
    console.error(JSON.stringify({
      success: false,
      error: 'Usage: node approve_mr.cjs --project <group/project> --iid <mr_iid> [--sha <sha>]'
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
    const result = await approveMR(projectPath, mrIid, sha);

    console.log(JSON.stringify({
      success: true,
      message: 'Merge request approved successfully',
      mr: {
        id: result.id,
        iid: result.iid,
        web_url: result.web_url
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
