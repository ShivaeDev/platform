import { expect } from "@effect/vitest";
import { WireRejection } from "#test/codex.ts";
import { providerStory } from "#test/providerStory.ts";
import { byCursor, page, turn } from "#test/wireScript.ts";

const DUPLICATES = page([turn("first", "completed", "operation-1"), turn("second", "completed", "operation-1")], "last");

for (const [fault, last, reason] of [
	["a running third turn", page([turn("third", "inProgress", "operation-1")]), "ambiguous"],
	["an unavailable last page", new WireRejection("Thread evidence is unavailable"), "rejected"],
	["a repeated page cursor", page([turn("third", "completed", "operation-1")], "last"), "protocol"],
] as const) {
	providerStory.it(`recovering duplicate turns with ${fault} fails as ${reason} without terminal receipts`, [], function* ({ answers, provider }) {
		yield* answers({ "thread/items/list": page([]), "thread/turns/list": byCursor({ first: DUPLICATES, last }) });

		const outcome = yield* provider.recover({ operationId: "operation-1", sessionId: "session-operation-1" });

		expect(outcome).toMatch(new RegExp(`^session ${reason}(?!.*terminal receipts)`, "u"));
	});
}
