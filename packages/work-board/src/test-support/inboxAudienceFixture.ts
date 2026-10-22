import { inboxQuestion } from "./inboxFixture.ts";

export function inboxAudienceFixture(maintainer = "maintainer", managed = true): Readonly<Record<string, string>> {
	function addressed(id: string, responder: string) {
		return `---
id: decision.${id}
kind: question
scope: task
urgency: whenever
attention:
  - id: direction
    kind: decision
    managed: ${managed}
    state: open
    reason: Question for ${id}
    response_from: [${responder}]
    unblocks: [decision.${id}]
---
# Question for ${id}
`;
	}
	return {
		"orchestrator.md": addressed("orchestrator", "orchestrator"),
		"reader.md": addressed("reader", maintainer),
		"unaddressed.md": inboxQuestion,
	};
}
