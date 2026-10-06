# Scripts

[English](README.md) | [简体中文](README_zh.md)

- `build-release.sh`: builds static Linux, macOS, and Windows bridge packages and the Linux service release.
- `ci-test.sh`: runs the repository test unit.
- `ci-build.sh`: runs the repository cross-platform compile/package unit.
- `ci-release.sh`: verifies release assets before a hosting-provider CD job publishes them.
- `install-git-hooks.sh`: installs the cleanup hook for the empty `master` workspace.
- `post-checkout-master-clean.sh`: removes local files after checking out `master`.
