#!/usr/bin/env node
/**
 * 调试脚本 - 查找用户作为 approver 的 MR（通过 Approval Rules）
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
    console.log(`当前用户: ${user.name} (id: ${user.id}, username: ${user.username})\n`);

    console.log('=== 检查 MR 的 Approval Rules ===');
    const projects = await gitlabRequest('/api/v4/projects?membership=true&per_page=100&simple=true');

    let foundMrs = [];
    let processedCount = 0;

    for (const project of projects) {
      try {
        const allMrs = await gitlabRequest(`/api/v4/projects/${project.id}/merge_requests?state=opened&per_page=100`);
        for (const mr of allMrs) {
          if (mr.author.id === user.id) continue; // 跳过自己创建的

          processedCount++;

          // 获取 MR 的 approval 状态和规则
          try {
            const approvalState = await gitlabRequest(`/api/v4/projects/${project.id}/merge_requests/${mr.iid}/approvals`);
            const rules = approvalState.approval_rules || [];

            // 检查用户是否在 approval rules 中
            const isApprover = rules.some(rule => {
              if (!rule.users) return false;
              return rule.users.some(u => u.id === user.id);
            });

            if (isApprover) {
              console.log(`\n找到 MR: !${mr.iid} ${mr.title}`);
              console.log(`  项目: ${project.path_with_namespace}`);
              console.log(`  作者: ${mr.author.username}`);
              console.log(`  链接: ${mr.web_url}`);
              foundMrs.push({ ...mr, project_path: project.path_with_namespace });
            }
          } catch (err) {
            // 有些项目可能不支持 approvals API
          }
        }
      } catch (err) {
        // 忽略错误
      }
    }

    console.log(`\n=== 总结 ===`);
    console.log(`处理了 ${processedCount} 个其他用户创建的 MR`);
    console.log(`找到 ${foundMrs.length} 个需要你批准（approve）的 MR`);

  } catch (error) {
    console.error('错误:', error.message);
  }
}

main();
