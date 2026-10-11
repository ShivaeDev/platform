import { Effect, Schema } from "effect";
import { codexAdapter } from "#providers/codexAdapter.ts";
import type { CodexRequest } from "#providers/codexTurns.ts";
import { SessionFailure } from "#session/schema.ts";

export function duplicateTurns(pageFault?: "unavailable" | "repeated") {
	const states = new Map<string, "completed" | "inProgress">([
		["first", "completed"],
		["second", "completed"],
		["third", "completed"],
	]);
	const rpc: CodexRequest = (method, params) =>
		Effect.gen(function* () {
			const request = Schema.decodeUnknownSync(
				Schema.Struct({ cursor: Schema.optional(Schema.NullOr(Schema.String)), itemsView: Schema.optional(Schema.String) }),
			)(params);
			if (pageFault === "unavailable" && request.cursor === "last") {
				return yield* new SessionFailure({ message: "Thread evidence is unavailable", reason: "unavailable" });
			}
			if (method === "thread/items/list") {
				return { data: [], nextCursor: null };
			}
			return {
				data: (request.cursor === "last" ? ["third"] : ["first", "second"]).map((id) => ({
					id,
					items: [{ clientId: "operation-1", id: `input-${id}`, type: "userMessage" }],
					status: states.get(id),
				})),
				nextCursor: request.cursor === "last" && pageFault !== "repeated" ? null : "last",
			};
		});
	return {
		adapter: () => codexAdapter(rpc, { beforeTurn: () => Effect.succeed({}), provisioning: "unknown", threadStart: () => ({}) }),
		states,
	};
}
