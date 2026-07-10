# Frontend Agent Rules

Goal: make the smallest correct change.

## Core Rules

- Implement only what was requested.
- Keep changes minimal and localized.
- Follow existing project style, naming, and architecture.
- Do not refactor unrelated code.
- Do not rename components, hooks, files, props, or state unless required.
- Do not introduce new abstractions, helpers, libraries, logs, comments, or optimizations unless asked or clearly necessary.
- Ask only when blocked; otherwise make a reasonable assumption and proceed.

## React Rules

- Keep components focused and reusable.
- Keep business logic out of UI components when existing hooks or state modules already handle it.
- Reuse existing React Query, Zustand, React Hook Form, and Tailwind patterns in the project.
- Preserve responsive behavior and accessibility.
- Do not break existing socket or authentication flows.

## API Safety

Unless explicitly requested, do not change:

- API endpoints
- request payloads
- response handling
- existing error handling

## Refactoring

- Prefer incremental changes over rewrites.
- Do not migrate large areas of CSS, Context, or state management in one task.
- Preserve existing UI behavior unless the task requires changes.

## Admin Rules

- Never prefetch admin data.
- Never persist admin data.
- Clear admin state immediately when verification is lost.
- Keep admin components isolated.

## Verification

After changes, briefly state:

- what files changed
- what was verified
- what was not verified
