#!/usr/bin/env node
/**
 * 检查 MR !600 的详细信息
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
    console.log('=== 获取当前用户 ===');
    const user = await gitlabRequest('/api/v4/user');
    console.log(`当前用户: ${user.username} (id: ${user.id})\n`);

    console.log('=== 获取所有项目 ===');
    const projects = await gitlabRequest('/api/v4/projects?membership=true&per_page=100');
    console.log(`获取到 ${projects.length} 个项目`);

    // 找到 tecq-fe-ui-editor 项目
    let targetProject = null;
    for (const p of projects) {
      if (p.path === 'tecq-fe-ui-editor' && p.path_with_namespace.includes('agile-gov/fe')) {
        targetProject = p;
        break;
      }
    }

    if (!targetProject) {
      console.log('\n未找到目标项目 tecq-fe-ui-editor');
      console.log('相似的项目:');
      for (const p of projects) {
        if (p.path.includes('ui-editor')) {
          console.log(`  - ${p.path_with_namespace} (id: ${p.id})`);
        }
      }
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

    // 检查当前用户是否在 reviewers 中
    const isReviewer = mr.reviewers && mr.reviewers.some(r => r.id === user.id);
    const isAssignee = mr.assignees && mr.assignees.some(a => a.id === user.id);

    console.log(`\n当前用户是 Reviewer: ${isReviewer ? '是' : '否'}`);
    console.log(`当前用户是 Assignee: ${isAssignee ? '是' : '否'}`);

    // 遍历所有项目，查找所有需要用户 review 的 MR
    console.log('\n=== 查找所有需要 review 的 MR ===');
    let foundMrs = [];
    for (const project of projects) {
      try {
        const allMrs = await gitlabRequest(`/api/v4/projects/${project.id}/merge_requests?state=opened&per_page=100`);
        for (const m of allMrs) {
          if (m.author.id === user.id) continue; // 跳过自己创建的
          if (m.reviewers && m.reviewers.some(r => r.id === user.id)) {
            foundMrs.push({
              iid: m.iid,
              title: m.title,
              project: project.path_with_namespace,
              author: m.author.username,
              reviewers: m.reviewers.map(r => r.username).join(', ')
            });
          }
        }
      } catch (e) {
        // 忽略错误
      }
    }

    console.log(`\n找到 ${foundMrs.length} 个需要你 review 的 MR:`);
    foundMrs.forEach(m => {
      console.log(`  - !${m.iid} ${m.title}`);
      console.log(`    项目: ${m.project}`);
      console.log(`    作者: ${m.author}`);
      console.log(`    Reviewers: ${m.reviewers}`);
      console.log('');
    });

  } catch (error) {
    console.error('错误:', error.message);
  }
}

main();
