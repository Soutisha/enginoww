# Task 15 — Visual Automation Builder

## Delivered

- Replaced the workflow detail page's JSON-only steps view with a visual, ordered workflow editor.
- Trigger selector for the workflow trigger types already exposed by the CRM.
- Scheduled trigger configuration fields for cron expression and timezone.
- Node palette for conditions, CRM actions, AI-agent tasks, human approvals, and wait/delay steps.
- Step selection, editable configuration, reorder controls, deletion, and a visual sequence preview.
- Client-side validation for missing triggers, schedule expressions, action choices, condition fields, delay values, and approvers.
- Save operation uses the existing company-scoped `PATCH /workflows/:id` API; definitions remain in the existing JSON `trigger` and `steps` fields, so no schema migration is needed.
- Archived workflows are read-only in the builder. Existing execution history, activity timeline, pause/activate, manual run, archive and duplicate controls remain available.

## Runtime boundaries (updated by Task 16)

Task 15 originally delivered only the visual definition builder. Task 16 adds a synchronous execution engine for selected node types. Task 17 adds an event dispatcher and scheduled-trigger scanner for the supported CRM events. Remaining boundaries:

- Cron/timezone values are now evaluated by the Task 17 worker once per minute; see Task 17 documentation for the supported five-field syntax.
- Payload-based condition evaluation and human approval checkpoints are implemented in Task 16. AI-agent nodes remain blocked until a configured agent runtime is integrated.
- Only the action handlers explicitly listed in `TASK16_WORKFLOW_EXECUTION_ENGINE.md` are executable. Other selected actions fail closed.
- Do not assume that external messaging, webhook actions, or AI-agent steps execute end-to-end.

## Verification

Run `pnpm verify:task15` for static implementation checks. Full dashboard type-check/build, database-backed persistence, and end-to-end workflow execution tests require installed dependencies and a configured runtime/database and were not performed in this environment.
