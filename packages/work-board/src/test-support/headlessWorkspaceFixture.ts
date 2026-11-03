export const TASK_SOURCE = `---
id: task
kind: task
status: ready
custom: {tracking: [one, two]}
fleet-priority: 7
---
# The task

Keep the task body exactly as written.
`;

export const DECISION_SOURCE = `---
id: decision
kind: question
scope: task
urgency: whenever
status: blocked
custom: {tracking: [one, two]}
attention:
  - id: direction
    kind: decision
    state: open
    response_from: [maintainer]
    reason: Choose a direction.
    unblocks: [task]
    custom: keep this too
---
# A decision

Keep the options and rationale here.
`;

export const SETTLED_DECISION_SOURCE = `---
id: settled
kind: question
scope: task
urgency: whenever
status: done
relationships: [{kind: relates_to, target: task}]
---
# Settled direction
`;

export const PLAIN_SOURCE = "\n# Plain note\n";
export const MALFORMED_SOURCE = "---\nstatus: [broken\n---\n# Task\n";
export const WINDOWS_SOURCE = `\uFEFF${TASK_SOURCE.replace(/\n/gu, "\r\n")}`;
export const MULTIPLE_REQUESTS_SOURCE = DECISION_SOURCE.replace(
	"---\n# A decision",
	"  - id: followup\n    kind: decision\n    state: open\n    response_from: [maintainer]\n    reason: Choose the followup.\n    unblocks: [task]\n---\n# A decision",
);
