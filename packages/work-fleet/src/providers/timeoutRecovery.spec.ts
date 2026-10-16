import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { codexAdapter } from "#providers/codexAdapter.ts";
import type { CodexRequest } from "#providers/codexTurns.ts";

for (const state of ["completed", "failed", "interrupted", "inProgress", "unknown", "matching"] as const) {
	it.effect(`a timed-out continuation reconciles a thread with prior turns: ${state}`, function* () {
		const requests: string[] = [];
		const rpc: CodexRequest = (method, params) =>
			Effect.sync(() => {
				requests.push(method);
				if (method === "turn/start") {
					expect(params).toMatchObject({ clientUserMessageId: "saved-operation", input: [{ text: "Saved prompt" }], threadId: "thread" });
					return { turn: { id: "resubmitted" } };
				}
				return {
					data: [
						{
							id: "existing",
							items: [{ clientId: state === "matching" ? "saved-operation" : "previous-operation", id: "input", type: "userMessage" }],
							status: state === "matching" ? "inProgress" : state,
						},
					],
					nextCursor: null,
				};
			});
		const provider = codexAdapter(rpc, {
			beforeTurn: () => Effect.succeed({}),
			provisioning: "unknown",
			recoveryGraceMs: 0,
			threadStart: () => ({}),
		});
		const recovered = yield* provider
			.reconcile({ operationId: "saved-operation", resume: { afterTimeout: true, prompt: "Saved prompt" }, sessionId: "thread" })
			.pipe(Effect.result);
		if (state === "inProgress" || state === "unknown") {
			expect(recovered).toMatchObject({ _tag: "Failure", failure: state === "unknown" ? { reason: "protocol" } : { code: "session-turn-missing" } });
			expect(requests).not.toContain("turn/start");
		} else {
			expect(recovered).toMatchObject({
				_tag: "Success",
				success: { sessionId: "thread", turnId: state === "matching" ? "existing" : "resubmitted" },
			});
			expect(requests.filter((method) => method === "turn/start")).toHaveLength(state === "matching" ? 0 : 1);
		}
		expect(requests[0]).toBe("thread/turns/list");
		expect(requests).not.toContain("thread/start");
	});
}
