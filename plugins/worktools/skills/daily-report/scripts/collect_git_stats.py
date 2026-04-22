#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
收集指定目录下所有 git 仓库的今日提交记录
"""
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# 修复 Windows 控制台编码
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")


def get_git_repos(base_path: str) -> list[str]:
    """获取目录下所有 git 仓库路径"""
    repos = []
    base = Path(base_path)
    if not base.exists():
        return repos

    for item in base.iterdir():
        if item.is_dir() and (item / ".git").exists():
            repos.append(str(item))
    return repos


def get_git_user_name() -> str:
    """获取当前 git 用户名"""
    try:
        result = subprocess.run(
            ["git", "config", "user.name"],
            capture_output=True,
            text=True,
            encoding="utf-8"
        )
        return result.stdout.strip()
    except:
        return ""


def get_today_commits(repo_path: str, author: str = None) -> dict:
    """获取指定仓库今天的提交记录"""
    today = datetime.now().strftime("%Y-%m-%d")

    try:
        # 构建命令
        cmd = ["git", "log", "--all", "--oneline", "--since=" + today + " 00:00:00"]
        if author:
            cmd.append(f"--author={author}")
        cmd.append("--date=short")

        # 获取今天的提交
        result = subprocess.run(
            cmd,
            cwd=repo_path,
            capture_output=True,
            text=True,
            encoding="utf-8"
        )

        commits = []
        if result.stdout.strip():
            commits = result.stdout.strip().split("\n")

        # 获取修改的文件
        files_result = subprocess.run(
            ["git", "log", "--all", "--name-only", "--pretty=format:",
             "--since=" + today + " 00:00:00"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            encoding="utf-8"
        )

        files = list(set(f for f in files_result.stdout.strip().split("\n") if f))

        # 获取代码行数变化
        stats_result = subprocess.run(
            ["git", "log", "--all", "--shortstat", "--since=" + today + " 00:00:00"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            encoding="utf-8"
        )

        return {
            "repo": Path(repo_path).name,
            "path": repo_path,
            "commits": commits,
            "files": files,
            "stats": stats_result.stdout.strip()
        }
    except Exception as e:
        return {
            "repo": Path(repo_path).name,
            "path": repo_path,
            "error": str(e)
        }


def main():
    # 默认扫描的目录列表
    default_paths = [
        "D:/Workspace/kaizen/fe",
        "D:/Workspace/kaizen/resource"
        # 可以添加更多目录
    ]

    # 获取当前 git 用户名
    author = get_git_user_name()

    all_stats = []

    for base_path in default_paths:
        repos = get_git_repos(base_path)
        for repo in repos:
            stats = get_today_commits(repo, author)
            if stats.get("commits") or stats.get("files"):
                all_stats.append(stats)

    # 输出收集结果
    print("=" * 50)
    print(f"📅 今日工作统计 ({datetime.now().strftime('%Y-%m-%d')})")
    print("=" * 50)

    if not all_stats:
        print("\n今天没有提交记录")
        return

    for stat in all_stats:
        print(f"\n## 📁 {stat['repo']}")
        print(f"   路径: {stat['path']}")

        if stat.get("commits"):
            print(f"\n   提交数量: {len(stat['commits'])}")
            print("   提交记录:")
            for commit in stat["commits"]:
                print(f"   - {commit}")

        if stat.get("files"):
            print(f"\n   修改文件 ({len(stat['files'])} 个):")
            for f in stat["files"][:20]:  # 最多显示 20 个
                print(f"   - {f}")
            if len(stat["files"]) > 20:
                print(f"   - ... 还有 {len(stat['files']) - 20} 个文件")

        if stat.get("stats"):
            print(f"\n   代码统计: {stat['stats']}")

    print("\n" + "=" * 50)


if __name__ == "__main__":
    main()
