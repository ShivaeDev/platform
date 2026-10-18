import { Effect } from "effect";
import { expect } from "vitest";
import { requestCursor, WireRejection } from "#test/codex.ts";
import { providerStory } from "#test/providerStory.ts";

for (const fault of ["running", "unavailable", "repeated"] as const) {
	providerStory.it(`duplicate turns with ${fault} evidence do not supply terminal receipts`, [], function* ({ provider, replyWith }) {
		yield* replyWith((request) => {
			const cursor = requestCursor(request);
			if (fault === "unavailable" && cursor === "last") {
				return new WireRejection("Thread evidence is unavailable");
			}
			if (request.method === "thread/items/list") {
				return { data: [], nextCursor: null };
			}
			return {
				data: (cursor === "last" ? ["third"] : ["first", "second"]).map((id) => ({
					id,
					items: [{ clientId: "operation-1", id: `input-${id}`, type: "userMessage" }],
					status: fault === "running" && id === "third" ? "inProgress" : "completed",
				})),
				nextCursor: cursor === "last" && fault !== "repeated" ? null : "last",
			};
		});
		const failed = yield* provider.reconcile({ operationId: "operation-1", sessionId: "session-operation-1" }).pipe(Effect.flip);
		expect(failed.terminalReceipts).toBeUndefined();
		expect(failed.reason).toBe({ repeated: "protocol", running: "ambiguous", unavailable: "rejected" }[fault]);
	});
}
