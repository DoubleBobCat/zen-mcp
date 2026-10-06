# 脚本

[English](README.md) | [简体中文](README_zh.md)

- `build-release.sh`：构建 Linux、macOS 和 Windows 静态 bridge 包以及 Linux 服务发布包。
- `ci-test.sh`：运行仓库测试单元。
- `ci-build.sh`：运行仓库跨平台编译和打包单元。
- `ci-release.sh`：在托管平台 CD 任务发布前验证发布资产。
- `install-git-hooks.sh`：为 master 空工作区安装清理 hook。
- `post-checkout-master-clean.sh`：切换到 master 后移除本地文件。
