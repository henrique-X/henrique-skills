#!/usr/bin/env node
/**
 * 调试 ui-editor 项目
 */

const http = require('http');

const GITLAB_URL = process.env.GITLAB_URL;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;

function gitlabRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, GITLAB_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'PRIVATE-TOKEN': GITLAB_TOKEN,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    const user = await gitlabRequest('/api/v4/user');
    console.log(`当前用户: ${user.username} (id: ${user.id})\n`);

    console.log('=== 查找 ui-editor 项目 ===');
    const projects = await gitlabRequest('/api/v4/projects?membership=true&per_page=100');

    let uiEditorProject = null;
    for (const p of projects) {
      if (p.path === 'tecq-fe-ui-editor' || p.path_with_namespace.includes('ui-editor')) {
        console.log(`找到: ${p.path_with_namespace} (id: ${p.id})`);
        if (p.path === 'tecq-fe-ui-editor') {
          uiEditorProject = p;
        }
      }
    }

    if (!uiEditorProject) {
      console.log('\n未找到 tecq-fe-ui-editor 项目');
      console.log('尝试直接访问...\n');

      // 直接尝试通过路径访问
      try {
        const directProject = await gitlabRequest('/api/v4/projects/agile-gov%2Ffe%2Ftecq-fe-ui-editor');
        if (directProject) {
          console.log(`直接访问成功: ${directProject.path_with_namespace} (id: ${directProject.id})`);
          uiEditorProject = directProject;
        }
      } catch (e) {
        console.log('直接访问失败:', e.message);
      }
    }

    if (uiEditorProject) {
      console.log(`\n=== 检查项目 ${uiEditorProject.path_with_namespace} 的 MR ===`);

      const mrs = await gitlabRequest(`/api/v4/projects/${uiEditorProject.id}/merge_requests?state=opened&per_page=100`);
      console.log(`找到 ${mrs.length} 个开放的 MR\n`);

      for (const mr of mrs) {
        const isSelf = mr.author.id === user.id;
        const isReviewer = mr.reviewers && mr.reviewers.some(r => r.id === user.id);

        console.log(`MR !${mr.iid}: ${mr.title}`);
        console.log(`  作者: ${mr.author.username} ${isSelf ? '(你)' : ''}`);
        console.log(`  Reviewers: ${mr.reviewers ? mr.reviewers.map(r => r.username).join(', ') : 'none'}`);
        console.log(`  你是 Reviewer: ${isReviewer ? '是' : '否'}`);
        console.log('');
      }

      // 特别检查 MR 600
      console.log('=== 特别检查 MR !600 ===');
      const mr600 = await gitlabRequest(`/api/v4/projects/${uiEditorProject.id}/merge_requests/600`);
      if (mr600) {
        console.log(`MR !${mr600.iid}: ${mr600.title}`);
        console.log(`  作者: ${mr600.author.username}`);
        console.log(`  Reviewers: ${mr600.reviewers ? mr600.reviewers.map(r => r.username).join(', ') : 'none'}`);
        console.log(`  你是 Reviewer: ${mr600.reviewers && mr600.reviewers.some(r => r.id === user.id) ? '是' : '否'}`);
      }
    }

  } catch (error) {
    console.error('错误:', error.message);
  }
}

main();
