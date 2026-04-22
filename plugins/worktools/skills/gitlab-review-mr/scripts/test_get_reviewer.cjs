#!/usr/bin/env node
/**
 * 测试获取 reviewer MR
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

    console.log('=== 查找需要 review 的 MR ===');
    const projects = await gitlabRequest('/api/v4/projects?membership=true&per_page=100');
    console.log(`获取到 ${projects.length} 个项目\n`);

    let foundMrs = [];

    for (const project of projects.slice(0, 20)) { // 只检查前20个
      try {
        const mrs = await gitlabRequest(`/api/v4/projects/${project.id}/merge_requests?state=opened&per_page=100`);
        if (mrs && mrs.length > 0) {
          for (const mr of mrs) {
            // 排除自己创建的
            if (mr.author.id === user.id) continue;
            // 检查是否在 reviewers 中
            if (mr.reviewers && mr.reviewers.some(r => r.id === user.id)) {
              foundMrs.push({
                iid: mr.iid,
                title: mr.title,
                project: project.path_with_namespace,
                author: mr.author.username,
                web_url: mr.web_url
              });
            }
          }
        }
      } catch (e) {
        // 忽略
      }
    }

    console.log(`找到 ${foundMrs.length} 个需要 review 的 MR:\n`);
    foundMrs.forEach(m => {
      console.log(`- !${m.iid} ${m.title}`);
      console.log(`  项目: ${m.project}`);
      console.log(`  作者: ${m.author}`);
      console.log(`  链接: ${m.web_url}`);
      console.log('');
    });

  } catch (error) {
    console.error('错误:', error.message);
  }
}

main();
