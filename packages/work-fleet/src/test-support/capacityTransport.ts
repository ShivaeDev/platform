import { Effect } from "effect";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { SessionFailure } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";

export function capacityTransport(explicit: boolean): typeof SessionTransport.Service {
	const failedTurns = {
		data: [
			{ error: { codexErrorInfo: "serverOverloaded", message: "Synthetic terminal capacity" }, id: "synthetic-turn", items: [], status: "failed" },
		],
		nextCursor: null,
	};
	const transport = codexAdapter((method) => Effect.succeed(method === "thread/turns/list" ? failedTurns : { data: [], nextCursor: null }), {
		beforeTurn: () => Effect.succeed({}),
		provisioning: "ready",
		threadStart: () => ({}),
	});
	return {
		...transport,
		startSession: () =>
			Effect.fail(
				new SessionFailure({
					...(explicit ? { capacity: "serverOverloaded" as const } : {}),
					message: "Synthetic capacity rejection",
					reason: "rejected",
				}),
			),
	};
}
