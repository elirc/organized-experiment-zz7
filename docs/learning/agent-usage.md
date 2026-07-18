# Agent Usage

This build used three sub-agents so the main thread could keep the critical backend path moving while parallel work happened on non-overlapping write sets.

How the split worked:

- Frontend shell agent
  Owned `src/components/**`, `src/hooks/**`, `src/app/login/**`, and layout/page shell files.
  Why this helped: The UI shell, page composition, and React Query hooks could advance in parallel with backend work because they mostly depended on stable endpoint names rather than database implementation details.

- Validation and test agent
  Owned `src/lib/validation/**`, `src/test/**`, and `vitest.config.ts`.
  Why this helped: Validation schemas and lightweight tests are excellent sidecar work. They define boundary contracts early and immediately exposed naming drift between the permission guard I started and the permission contract the tests expected.

- Documentation agent
  Owned `docs/**`.
  Why this helped: It created the documentation surface area early so the final sync became refinement instead of starting docs from zero after coding was done.

Why this division was safe:

- The write sets were disjoint: backend core stayed local, UI stayed with one agent, validation/tests stayed with another, and docs stayed with a third.
- The main thread kept ownership of the critical path: schema, repositories, services, route handlers, auth integration, and final verification.
- Agent work was integrated, not trusted blindly. The validation agent’s contract shaped `src/lib/auth/permissions.ts`, and the docs were rewritten to match the final implementation.

What stronger engineers should notice:

- Parallelization helps only when boundaries are clear.
- The fastest split is not “three people touching everything”; it is “three people owning different surfaces with a clearly owned integration step.”
- The main risk with agent use is contract drift, which is why the final pass focused on aligning route names, permission strings, and request/response shapes across code, tests, and docs.
