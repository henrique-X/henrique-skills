#!/usr/bin/env node
/**
 * 检查指定 MR 的详细信息
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
    // 获取当前用户信息
    console.log('=== 获取当前用户 ===');
    const currentUser = await gitlabRequest('/api/v4/user');
    console.log(`当前用户: ${currentUser.username} (id: ${currentUser.id})\n`);

    // 获取所有项目，找到 tecq-fe-ui-editor
    console.log('=== 获取所有项目 ===');
    const allProjects = await gitlabRequest('/api/v4/projects?membership=true&per_page=100');
    console.log(`获取到 ${allProjects.length} 个项目`);

    let targetProject = null;
    for (const p of allProjects) {
      if (p.path === 'tecq-fe-ui-editor' && p.path_with_namespace.includes('agile-gov/fe')) {
        targetProject = p;
        break;
      }
    }

    if (!targetProject) {
      console.log('\n未找到目标项目 tecq-fe-ui-editor');
      console.log('相似的项目:');
      for (const p of allProjects) {
        if (p.path.includes('ui-editor')) {
          console.log(`  - ${p.path_with_namespace} (id: ${p.id})`);
        }
      }
      return;
    }

    console.log(`\n目标项目: ${targetProject.path_with_namespace} (id: ${targetProject.id})`);

    // 获取 MR 详细信息
    console.log('\n=== 获取 MR 详细信息 ===');
    const mr = await gitlabRequest(`/api/v4/projects/${targetProject.id}/merge_requests/${MR_IID}`);
    console.log(`MR IID: ${mr.iid}`);
    console.log(`标题: ${mr.title}`);
    console.log(`作者: ${mr.author.username} (${mr.author.name})`);
    console.log(`状态: ${mr.state}`);
    console.log(`Reviewers: ${mr.reviewers && mr.reviewers.length > 0 ? mr.reviewers.map(r => `${r.username} (id:${r.id})`).join(', ') : 'none'}`);
    console.log(`Assignees: ${mr.assignees && mr.assignees.length > 0 ? mr.assignees.map(a => `${a.username} (id:${a.id})`).join(', ') : 'none'}`);

    // 检查当前用户是否在 reviewers 中
    const isReviewer = mr.reviewers && mr.reviewers.some(r => r.id === currentUser.id);
    const isAssignee = mr.assignees && mr.assignees.some(a => a.id === currentUser.id);

    console.log(`\n当前用户是 Reviewer: ${isReviewer ? '是' : '否'}`);
    console.log(`当前用户是 Assignee: ${isAssignee ? '是' : '否'}`);

  } catch (error) {
    console.error('错误:', error.message);
  }
}

main();
