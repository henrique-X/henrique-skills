#!/usr/bin/env node
/**
 * 测试 GitLab API 连接
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
        console.log(`Status: ${res.statusCode}`);
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
    console.log('1. 获取当前用户...');
    const user = await gitlabRequest('/api/v4/user');
    console.log('当前用户:', JSON.stringify(user, null, 2));

    console.log('\n2. 获取项目列表...');
    const projects = await gitlabRequest('/api/v4/projects?membership=true&per_page=5&simple=true');
    console.log(`找到 ${projects.length} 个项目:`);
    projects.forEach(p => console.log(`  - ${p.path_with_namespace} (id: ${p.id})`));

    console.log('\n3. 获取用户的 MR (assigned)...');
    const assignedMrs = await gitlabRequest(`/api/v4/merge_requests?scope=assigned_to_me&state=opened`);
    console.log(`找到 ${assignedMrs.length} 个分配给我的 MR (assigned):`);
    assignedMrs.forEach(mr => console.log(`  - !${mr.iid} ${mr.title} (project: ${mr.project_id})`));

    console.log('\n4. 获取用户的 MR (reviewer)...');
    // 尝试使用 reviewer_id 参数（仅部分 GitLab 版本支持）
    const reviewerMrs = await gitlabRequest(`/api/v4/merge_requests?reviewer_id=${user.id}&state=opened`);
    console.log(`找到 ${reviewerMrs.length} 个分配给我的 MR (reviewer):`);
    reviewerMrs.forEach(mr => console.log(`  - !${mr.iid} ${mr.title} (project: ${mr.project_id})`));

  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

main();
