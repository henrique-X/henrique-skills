#!/usr/bin/env node
/**
 * 向 GitLab Merge Request 发布评论
 *
 * 环境变量:
 *   GITLAB_URL - GitLab 实例 URL
 *   GITLAB_TOKEN - Personal Access Token
 *
 * 参数:
 *   --project <path> - 项目路径 (如: group/project)
 *   --iid <number> - Merge Request IID
 *   --comment <text> - 评论内容
 *   --file <path> - 从文件读取评论内容
 *   --type <type> - 评论类型: overall (总体评论) 或 inline (行内评论)
 *   --file-path <path> - 行内评论: 文件路径
 *   --line <number> - 行内评论: 行号
 *   --sha <sha> - 行内评论: commit SHA (使用 base_sha 或 head_sha)
 *
 * 输出格式: JSON
 */

const http = require('http');
const https = require('https');
const fs = require('fs');

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

// 发布总体评论（MR 级别）
async function postOverallComment(projectPath, mrIid, comment) {
  const encodedPath = urlEncode(projectPath);
  const path = `/api/v4/projects/${encodedPath}/merge_requests/${mrIid}/notes`;

  const data = { body: comment };
  return await gitlabRequest(path, 'POST', data);
}

// 发布行内评论（代码级别）
async function postInlineComment(projectPath, mrIid, filePath, line, baseSha, headSha, comment, isDeleted = false) {
  const encodedPath = urlEncode(projectPath);
  const path = `/api/v4/projects/${encodedPath}/merge_requests/${mrIid}/discussions`;

  const position = {
    base_sha: baseSha,
    head_sha: headSha,
    start_sha: baseSha,
    position_type: 'text'
  };

  if (isDeleted) {
    // 删除的行使用 old_path 和 old_line
    position.old_path = filePath;
    position.old_line = line;
  } else {
    // 新增或修改的行使用 new_path 和 new_line
    position.new_path = filePath;
    position.new_line = line;
  }

  const data = {
    body: comment,
    position: position
  };

  return await gitlabRequest(path, 'POST', data);
}

async function main() {
  const args = process.argv.slice(2);
  let projectPath = null;
  let mrIid = null;
  let comment = null;
  let commentType = 'overall';
  let filePath = null;
  let line = null;
  let baseSha = null;
  let headSha = null;
  let isDeleted = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      projectPath = args[i + 1]; i++;
    } else if (args[i] === '--iid' && args[i + 1]) {
      mrIid = args[i + 1]; i++;
    } else if (args[i] === '--comment' && args[i + 1]) {
      comment = args[i + 1]; i++;
    } else if (args[i] === '--file' && args[i + 1]) {
      comment = fs.readFileSync(args[i + 1], 'utf-8'); i++;
    } else if (args[i] === '--type' && args[i + 1]) {
      commentType = args[i + 1]; i++;
    } else if (args[i] === '--file-path' && args[i + 1]) {
      filePath = args[i + 1]; i++;
    } else if (args[i] === '--line' && args[i + 1]) {
      line = parseInt(args[i + 1]); i++;
    } else if (args[i] === '--base-sha' && args[i + 1]) {
      baseSha = args[i + 1]; i++;
    } else if (args[i] === '--head-sha' && args[i + 1]) {
      headSha = args[i + 1]; i++;
    } else if (args[i] === '--is-deleted') {
      isDeleted = true;
    }
  }

  if (!projectPath || !mrIid || !comment) {
    console.error(JSON.stringify({
      success: false,
      error: 'Usage: node post_comment.cjs --project <group/project> --iid <mr_iid> --comment <text> [--type overall|inline] [--file-path <path> --line <n> --base-sha <sha> --head-sha <sha>] [--is-deleted]'
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
    let result;
    if (commentType === 'inline') {
      if (!filePath || !line || !baseSha || !headSha) {
        throw new Error('Inline comments require --file-path, --line, --base-sha, and --head-sha');
      }
      result = await postInlineComment(projectPath, mrIid, filePath, line, baseSha, headSha, comment, isDeleted);
      console.log(JSON.stringify({
        success: true,
        type: 'inline',
        message: 'Inline comment posted successfully',
        comment: {
          file: filePath,
          line: line,
          id: result.id
        }
      }, null, 2));
    } else {
      result = await postOverallComment(projectPath, mrIid, comment);
      console.log(JSON.stringify({
        success: true,
        type: 'overall',
        message: 'Overall comment posted successfully',
        comment: {
          id: result.id,
          body: result.body
        }
      }, null, 2));
    }
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }));
    process.exit(1);
  }
}

main();
