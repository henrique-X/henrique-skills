#!/usr/bin/env node
/**
 * 查找 tecq-fe-ui-editor 项目和 MR
 */

const http = require('http');

const GITLAB_URL = process.env.GITLAB_URL;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const MR_IID = 600;

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

    console.log('=== 查找所有包含 "ui-editor" 的项目 ===');
    const projects = await gitlabRequest('/api/v4/projects?membership=true&per_page=100');

    let targetProject = null;
    for (const p of projects) {
      if (p.path.includes('ui-editor') || p.name.includes('ui-editor')) {
        console.log(`  - ${p.path_with_namespace} (id: ${p.id})`);
        if (p.path === 'tecq-fe-ui-editor' || p.path_with_namespace === 'agile-gov/fe/tecq-fe-ui-editor') {
          targetProject = p;
        }
      }
    }

    if (!targetProject) {
      console.log('\n未找到项目 agile-gov/fe/tecq-fe-ui-editor');
      console.log('可能项目名称不同，请检查 URL');
      return;
    }

    console.log(`\n目标项目: ${targetProject.path_with_namespace} (id: ${targetProject.id})`);

    console.log('\n=== 获取 MR !600 详细信息 ===');
    const mr = await gitlabRequest(`/api/v4/projects/${targetProject.id}/merge_requests/${MR_IID}`);
    console.log(`MR IID: ${mr.iid}`);
    console.log(`标题: ${mr.title}`);
    console.log(`作者: ${mr.author.username} (${mr.author.name})`);
    console.log(`状态: ${mr.state}`);
    console.log(`Reviewers: ${mr.reviewers && mr.reviewers.length > 0 ? mr.reviewers.map(r => `${r.username} (id:${r.id})`).join(', ') : 'none'}`);
    console.log(`Assignees: ${mr.assignees && mr.assignees.length > 0 ? mr.assignees.map(a => `${a.username} (id:${a.id})`).join(', ') : 'none'}`);

    const isReviewer = mr.reviewers && mr.reviewers.some(r => r.id === user.id);
    const isAssignee = mr.assignees && mr.assignees.some(a => a.id === user.id);

    console.log(`\n当前用户是 Reviewer: ${isReviewer ? '是' : '否'}`);
    console.log(`当前用户是 Assignee: ${isAssignee ? '是' : '否'}`);

  } catch (error) {
    console.error('错误:', error.message);
  }
}

main();
