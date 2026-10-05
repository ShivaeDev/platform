import { reasoningFixture } from "./reasoningFixture.ts";

export function attentionFixture(): Readonly<Record<string, string>> {
	const files = reasoningFixture();
	return {
		...files,
		"attention/blocker.md": `---
id: request.fixture
kind: task
attention:
  - id: missing-fixture
    kind: blocker
    state: open
    response_from: [agent-navigation]
    reason: Supply a representative keyboard fixture.
    unblocks: [work.search#keyboard]
---
# Keyboard fixture
`,
		"attention/not-a-request.md":
			"---\nid: ordinary.review\nstatus: in-review\nowner: marvin\nnext_action: Ask Marvin\n---\n# Arbitrary source labels\n",
		"attention/review.md": `---
id: request.search
kind: result
status: finished
owner: someone-else
attention:
  - id: keyboard-review
    kind: review
    state: open
    response_from: [marvin, agent-navigation]
    reason: Review keyboard evidence before continuing.
    unblocks: [work.search#keyboard]
  - id: matching-decision
    kind: decision
    state: open
    response_from: [marvin]
    reason: Choose literal matching or fuzzy matching.
    unblocks: [decision.search]
  - id: prior-review
    kind: review
    state: closed
    response_from: [marvin]
    reason: A closed request has no implied answer.
    unblocks: [work.search]
---
# Search judgments

[Options and rationale](../decision.md#heading-rationale).
[Recorded result](../results/search.md).
`,
	};
}
