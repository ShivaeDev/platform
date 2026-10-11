import { Effect, Schema } from "effect";
import { failure } from "#providers/codexRpc.ts";
import type { CodexRequest } from "#providers/codexTurns.ts";

export const uncertainEvidence = ["missing-session", "missing-thread", "unrelated", "duplicates", "broken-page", "missing-prompt"] as const;
export function recoveryEvidence(scenario: (typeof uncertainEvidence)[number], requests: string[]): CodexRequest {
	return (method, params) =>
		Effect.gen(function* () {
			requests.push(method);
			const cursor = Schema.decodeUnknownSync(Schema.Struct({ cursor: Schema.NullOr(Schema.String) }))(params).cursor;
			if (scenario === "missing-thread" || (scenario === "broken-page" && cursor === "second")) {
				return yield* Effect.fail(failure("unavailable", "Thread evidence is unavailable"));
			}
			const matching = { id: "turn", items: [{ clientId: "operation", id: "input", type: "userMessage" }], status: "inProgress" };
			switch (scenario) {
				case "duplicates":
					return { data: [matching, { ...matching, id: "other" }], nextCursor: null };
				case "unrelated":
					return { data: [{ ...matching, items: [] }], nextCursor: null };
				case "broken-page":
					return { data: [], nextCursor: "second" };
				default:
					return { data: [], nextCursor: null };
			}
		});
}
