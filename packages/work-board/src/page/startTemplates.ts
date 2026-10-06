export const startTemplates = [
	{
		file: "project.md",
		label: "Project",
		source: `---
id: example.project
kind: project
criteria:
  - id: readable-result
    text: A reviewer can trace the result to its reasoning and recorded evidence.
---
# Project

## Goal
Describe the outcome and who needs it.

## Scope and constraints
Name what belongs here and what must remain outside this work.

## Reading path
- [Investigation](investigation.md)
- [Agent result](result.md)

## Acceptance
The criterion above is a target, not a recorded pass.
Record what was checked, the source revision, and remaining limitations.
`,
	},
	{
		file: "investigation.md",
		label: "Investigation",
		source: `---
id: example.investigation
kind: investigation
relationships:
  - kind: informs
    target: example.project
criteria:
  - id: explained-choice
    text: Options, evidence, tradeoffs and the recommendation are explicit.
---
# Investigation

## Question and background
Explain the decision in context; do not require the reader to reconstruct it.

## Options and tradeoffs
| Option | Benefit | Cost | Evidence |
| --- | --- | --- | --- |
| First option | Not recorded | Not recorded | Not recorded |
| Second option | Not recorded | Not recorded | Not recorded |

## Recommendation
State your take and what remains uncertain.

## Response needed
Name the exact question and the choices. Do not imply that a response was recorded.

[Project and acceptance target](project.md)
`,
	},
	{
		file: "result.md",
		label: "Agent result",
		source: `---
id: example.result
kind: result
relationships:
  - kind: implements
    target: example.investigation
  - kind: relates_to
    target: example.project
# Add evidence only after a real observation; replace every placeholder:
# evidence:
#   - criterion: example.project#readable-result
#     source: ./evidence/reading-check.md
#     method: Describe the actual check.
#     outcome: Describe the observed result and its limits.
#     observed_at: Use the actual ISO timestamp with timezone.
#     checked_revision: Use the actual full source commit SHA.
---
# Agent result

## Outcome and changes
Explain what changed and why. Link the relevant source files or patch.

## Reasoning
[Investigation and alternatives](investigation.md)

## Checks and evidence
Not recorded. Replace this with actual commands, observations and local evidence links.
Recorded evidence does not by itself establish verified acceptance.

## Limits and unresolved questions
Name failures, skipped checks, uncertainty and any response needed.

## Next action
State the next action and who needs to respond, if known.

[Project and acceptance target](project.md)
`,
	},
] as const;
