#!/usr/bin/env node
/**
 * 直接访问 ui-editor 项目的 MR
 */

const http = require('http');

const GITLAB_URL = process.env.GITLAB_URL;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;

function gitlabRequest(path, projectId = null) {
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
        console.log(`  [${projectId || 'global'}] ${path} -> ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else if (res.statusCode === 404) {
          resolve(null); // 返回 null 表示未找到
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

    console.log('=== 尝试访问 ui-editor 项目 ===');

    // 尝试不同的项目路径
    const possiblePaths = [
      'agile-gov/fe/tecq-fe-ui-editor',
      'agile-gov%2Ffe%2Ftecq-fe-ui-editor', // URL 编码
    ];

    // 先尝试直接通过项目路径访问 MR
    console.log('\n1. 尝试通过项目路径访问 MR !600:');
    for (const path of possiblePaths) {
      try {
        const mr = await gitlabRequest(`/api/v4/projects/${encodeURIComponent(path)}/merge_requests/600`, path);
        if (mr) {
          console.log(`\n找到 MR !600 在项目 ${path}:`);
          console.log(`  标题: ${mr.title}`);
          console.log(`  作者: ${mr.author.username}`);
          console.log(`  Reviewers: ${mr.reviewers ? mr.reviewers.map(r => r.username).join(', ') : 'none'}`);
          console.log(`  你是 Reviewer: ${mr.reviewers && mr.reviewers.some(r => r.id === user.id) ? '是' : '否'}`);
          return;
        }
      } catch (e) {
        console.log(`    失败: ${e.message}`);
      }
    }

    // 尝试获取所有项目，打印所有包含 "ui" 或 "editor" 的项目
    console.log('\n2. 查找所有相关项目:');
    const projects = await gitlabRequest('/api/v4/projects?membership=true&per_page=100');

    console.log('\n包含 "editor" 的项目:');
    for (const p of projects) {
      if (p.path.includes('editor') || p.name.includes('editor')) {
        console.log(`  - ${p.path_with_namespace} (id: ${p.id})`);
      }
    }

    console.log('\n包含 "ui" 的项目:');
    for (const p of projects) {
      if ((p.path.includes('ui') || p.name.includes('ui')) && !p.path.includes('editor')) {
        console.log(`  - ${p.path_with_namespace} (id: ${p.id})`);
      }
    }

    // 尝试在每个项目上找 MR !600
    console.log('\n3. 在所有项目中查找 MR !600:');
    for (const p of projects) {
      try {
        const mr = await gitlabRequest(`/api/v4/projects/${p.id}/merge_requests/600`, p.id);
        if (mr) {
          console.log(`\n  项目 ${p.path_with_namespace} (id: ${p.id}):`);
          console.log(`    MR !${mr.iid}: ${mr.title}`);
          console.log(`    作者: ${mr.author.username}`);
          console.log(`    Reviewers: ${mr.reviewers ? mr.reviewers.map(r => r.username).join(', ') : 'none'}`);
        }
      } catch (e) {
        // 忽略
      }
    }

  } catch (error) {
    console.error('错误:', error.message);
  }
}

main();
