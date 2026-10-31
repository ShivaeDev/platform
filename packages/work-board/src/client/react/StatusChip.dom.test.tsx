import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { StatusChip } from "./StatusChip.tsx";

for (const [status, token, icon, label, variant] of [
	["draft", "deferred", "circle", "Draft", "outline"],
	["ready", "agent-working", "circle", "Ready", "outline"],
	["done", "done", "check", "Done", "outline"],
	["deferred", "deferred", "circle-pause", "Deferred", "outline"],
	["dropped", "deferred", "circle-x", "Dropped", "outline"],
	["queued", "deferred", "circle", "Queued", "outline"],
	["working", "agent-working", "loader-circle", "Working", "outline"],
	["reviewing", "agent-working", "loader-circle", "Reviewing", "outline"],
	["waiting", "waiting-on-agents", "users", "Waiting", "outline"],
	["released", "deferred", "circle-minus", "Released", "outline"],
	["needs-you", "needs-you", "message-circle", "Needs you", "default"],
	["unexpected", "deferred", "circle-help", "Unexpected", "outline"],
] as const) {
	screenStory.it(
		`The ${status} status reads as ${label} with the ${token} tone and the ${icon} icon`,
		[componentScreen(<StatusChip status={status} />)],
		function* ({ statusChips }) {
			expect(yield* statusChips()).toEqual([{ icon: expect.arrayContaining([icon]), label, token, variant }]);
		},
	);
}

for (const status of [undefined, ""]) {
	screenStory.it(
		`An absent status (${JSON.stringify(status)}) shows no chip`,
		[componentScreen(<StatusChip status={status} />)],
		function* ({ statusChips }) {
			expect(yield* statusChips()).toEqual([]);
		},
	);
}
