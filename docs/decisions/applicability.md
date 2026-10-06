# Applicability Decisions

All documentation-first-engineering stages have a current document in this
repository. No stage is satisfied by a historical cache or an unreviewed
placeholder decision.

- Stage 5 Plugin-Spec: applicable. `docs/specs/Plugin-Spec.md` documents the
  current browser extension package and runtime boundary.
- Stage 5 MCP-Spec: applicable. `docs/specs/MCP-Spec.md` documents the current
  callable tool contract.
- Stage 5 Workflow-Spec: applicable. `docs/specs/Workflow-Spec.md` documents
  the current bridge-to-extension request lifecycle.
- Stage 5 Event-Spec: applicable. `docs/specs/Event-Spec.md` documents the
  absence of a public event API and the internal disconnect control message.
- Stage 6 Data Design: applicable. `docs/Database-Design.md` documents the
  current transient in-memory state and the absence of project-owned storage.
- Stage 7 API Design: applicable. `docs/API/openapi.yaml` documents the
  Streamable HTTP adapter and the implemented tool inventory.
- Stage 10 Deployment/Operation: applicable. `docs/Deployment.md` and
  `docs/Operation.md` document the current local package and service workflow.
