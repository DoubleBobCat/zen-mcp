# Documentation

[English](README.md) | [简体中文](README_zh.md)

`AGENTS.md` contains only repository-wide constraints and the responsibility index. This directory contains current implementation documentation and the documentation-first-engineering stage documents; historical archives, working plans, and validation caches are not retained. When a responsibility changes, update the authoritative document first, then synchronize this index and the links in `AGENTS.md`.

## Current Documentation

| 职责 | 权威文档 |
| --- | --- |
| MCP tool inventory, parameters, results, and status | [`docs/api/all-tools.md`](api/all-tools.md) |
| Workspace tool details | [`docs/api/workspace-tools.md`](api/workspace-tools.md) |
| API contract | [`docs/api/openapi.yaml`](api/openapi.yaml) |
| Runtime architecture and component boundaries | [`docs/architecture/overview.md`](architecture/overview.md) |
| Development, build, debugging, and verification | [`docs/development/workflow.md`](development/workflow.md) |
| Deployment, packaging, permissions, and rollback | [`docs/Deployment.md`](Deployment.md) |
| Operation, troubleshooting, logs, and service management | [`docs/Operation.md`](Operation.md) |
| Project overview and quick start | [`README.md`](../README.md) |
| CI/CD, cross-platform builds, and releases | [`docs/development/workflow.md`](development/workflow.md), [`docs/Deployment.md`](Deployment.md) |

## Required Documentation Stages

The following files are the only stage documents retained in this repository:

- [`docs/Vision.md`](Vision.md)
- [`docs/PRD.md`](PRD.md)
- [`docs/SRS.md`](SRS.md)
- [`docs/Architecture.md`](Architecture.md)
- [`docs/specs/`](specs/)
- [`docs/Database-Design.md`](Database-Design.md)
- [`docs/API/openapi.yaml`](API/openapi.yaml)
- [`docs/Roadmap.md`](Roadmap.md)
- [`docs/Test-Plan.md`](Test-Plan.md)
- [`docs/Deployment.md`](Deployment.md)
- [`docs/Operation.md`](Operation.md)

`docs/API/openapi.yaml` is the required documentation-first-engineering path.
`docs/api/openapi.yaml` is the canonical lower-case API reference copy used by
the current API documentation and must remain synchronized with it.

All retained documents describe the current implementation. Future proposals and
superseded designs are not stored under `docs/`.

## Documentation Rules

- If a documented tool is not registered, not exposed, or not callable in the current runtime, mark it as `未完成` beside the tool name and exclude it from stable implemented lists.
- Keep generated artifacts under `build/` out of manual edits; the development and deployment documents define how to regenerate them.
- Keep compatibility paths required by the documentation workflow synchronized with their canonical documents.
