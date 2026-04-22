#!/usr/bin/env node
/**
 * 获取 GitLab Merge Request 的代码变更 (diff)
 *
 * 环境变量:
 *   GITLAB_URL - GitLab 实例 URL
 *   GITLAB_TOKEN - Personal Access Token
 *
 * 参数:
 *   --project <path> - 项目路径 (如: group/project)
 *   --iid <number> - Merge Request IID
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
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (method === 'POST') req.end();
    else req.end();
  });
}

function urlEncode(str) {
  // GitLab API 需要将路径中的 / 编码为 %2F
  // 例如: group/project -> group%2Fproject
  return encodeURIComponent(str);
}

async function getMRDiff(projectPath, mrIid) {
  try {
    // URL 编码项目路径
    const encodedPath = urlEncode(projectPath);

    // 获取 MR 的版本信息和 diff
    const diffPath = `/api/v4/projects/${encodedPath}/merge_requests/${mrIid}/diffs`;
    const mrPath = `/api/v4/projects/${encodedPath}/merge_requests/${mrIid}`;
    const changesPath = `/api/v4/projects/${encodedPath}/merge_requests/${mrIid}/changes`;

    const [diffs, mr, changes] = await Promise.all([
      gitlabRequest(diffPath),
      gitlabRequest(mrPath),
      gitlabRequest(changesPath)
    ]);

    return {
      success: true,
      mr: {
        id: mr.id,
        iid: mr.iid,
        title: mr.title,
        description: mr.description,
        web_url: mr.web_url,
        source_branch: mr.source_branch,
        target_branch: mr.target_branch
      },
      changes: {
        diff_refs: changes.diff_refs,
        files: changes.changes?.map(file => ({
          old_path: file.old_path,
          new_path: file.new_path,
          deleted_file: file.deleted_file,
          renamed_file: file.renamed_file,
          new_file: file.new_file,
          diff: file.diff,
          // 行内评论需要的 base_sha 和 head_sha
          base_sha: changes.diff_refs?.base_sha,
          head_sha: changes.diff_refs?.head_sha,
          start_sha: changes.diff_refs?.start_sha
        })) || []
      }
    };
  } catch (error) {
    throw new Error(`Failed to get MR diff: ${error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let projectPath = null;
  let mrIid = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      projectPath = args[i + 1];
      i++;
    } else if (args[i] === '--iid' && args[i + 1]) {
      mrIid = args[i + 1];
      i++;
    }
  }

  if (!projectPath || !mrIid) {
    console.error(JSON.stringify({
      success: false,
      error: 'Usage: node get_mr_diff.cjs --project <group/project> --iid <mr_iid>'
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
    const result = await getMRDiff(projectPath, mrIid);
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
