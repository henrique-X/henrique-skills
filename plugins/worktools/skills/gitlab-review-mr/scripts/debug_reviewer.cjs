#!/usr/bin/env node
/**
 * 调试脚本 - 查找用户作为 reviewer 的 MR
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
    console.log(`当前用户: ${user.name} (id: ${user.id})\n`);

    console.log('=== 测试1: 全局 API reviewer_id 参数 ===');
    try {
      const mrs1 = await gitlabRequest(`/api/v4/merge_requests?reviewer_id=${user.id}&state=opened`);
      console.log(`结果: 找到 ${mrs1.length} 个 MR`);
      if (mrs1.length > 0) {
        mrs1.forEach(mr => {
          console.log(`  - !${mr.iid} ${mr.title} (author: ${mr.author.username}, reviewers: ${mr.reviewers?.map(r => r.username).join(', ') || 'none'})`);
        });
      }
    } catch (e) {
      console.log(`错误: ${e.message}`);
    }

    console.log('\n=== 测试2: 获取所有项目并查询 ===');
    const projects = await gitlabRequest('/api/v4/projects?membership=true&per_page=100&simple=true');
    console.log(`找到 ${projects.length} 个项目`);

    let foundMrs = [];
    for (const project of projects.slice(0, 10)) { // 只检查前10个项目
      try {
        // 查询该项目的所有 opened MR，然后检查 reviewers
        const allMrs = await gitlabRequest(`/api/v4/projects/${project.id}/merge_requests?state=opened&per_page=50`);
        const myReviewerMrs = allMrs.filter(mr => {
          if (mr.author.id === user.id) return false; // 排除自己创建的
          if (!mr.reviewers || mr.reviewers.length === 0) return false;
          return mr.reviewers.some(r => r.id === user.id);
        });
        if (myReviewerMrs.length > 0) {
          console.log(`\n项目 ${project.path_with_namespace}:`);
          myReviewerMrs.forEach(mr => {
            console.log(`  - !${mr.iid} ${mr.title} (author: ${mr.author.username})`);
            foundMrs.push(mr);
          });
        }
      } catch (err) {
        // 忽略错误
      }
    }

    console.log(`\n=== 总结 ===`);
    console.log(`总共找到 ${foundMrs.length} 个需要你 review 的 MR`);

  } catch (error) {
    console.error('错误:', error.message);
  }
}

main();
