#!/usr/bin/env node
/**
 * 直接搜索 MR !600
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

    console.log('=== 方式1: 通过项目 ID 直接搜索 MR ===');
    // 尝试一些常见的项目 ID
    const possibleProjectIds = [345, 944, 903, 902, 901, 860, 900, 950, 1000];

    for (const pid of possibleProjectIds) {
      try {
        const mr = await gitlabRequest(`/api/v4/projects/${pid}/merge_requests/${MR_IID}`);
        console.log(`\n在项目 ${pid} 中找到 MR !${mr.iid}:`);
        console.log(`  标题: ${mr.title}`);
        console.log(`  作者: ${mr.author.username}`);
        console.log(`  Reviewers: ${mr.reviewers ? mr.reviewers.map(r => r.username).join(', ') : 'none'}`);
        console.log(`  你是 Reviewer: ${mr.reviewers && mr.reviewers.some(r => r.id === user.id) ? '是' : '否'}`);
        return;
      } catch (e) {
        // 继续
      }
    }

    console.log('\n=== 方式2: 搜索所有项目中包含 MR !600 的 ===');
    const projects = await gitlabRequest('/api/v4/projects?membership=true&per_page=100');

    for (const p of projects) {
      try {
        const mr = await gitlabRequest(`/api/v4/projects/${p.id}/merge_requests/${MR_IID}`);
        console.log(`\n找到 MR !${mr.iid} 在项目 ${p.path_with_namespace}:`);
        console.log(`  标题: ${mr.title}`);
        console.log(`  作者: ${mr.author.username}`);
        console.log(`  Reviewers: ${mr.reviewers ? mr.reviewers.map(r => r.username).join(', ') : 'none'}`);
        console.log(`  你是 Reviewer: ${mr.reviewers && mr.reviewers.some(r => r.id === user.id) ? '是' : '否'}`);
        return;
      } catch (e) {
        // 继续
      }
    }

    console.log('\n没有找到 MR !600，请确认:');
    console.log('1. MR 编号是否正确');
    console.log('2. 你是否有该项目的访问权限');
    console.log('3. MR 是否仍然存在（可能已被合并/关闭）');

  } catch (error) {
    console.error('错误:', error.message);
  }
}

main();
