import { Effect } from "effect";
import { diagnosticsDaemon } from "@shivaedev/work-board/test-support/diagnosticsDaemon.ts";
import { boardHttp } from "@shivaedev/work-fleet/test-support/boardHttp.ts";
import type { HostStoryEngine } from "@shivaedev/work-fleet/test-support/HostStoryEngine.ts";

// Older Fleet daemons expose stages but omit the optional execution details.
export const legacyFleetBoard = Effect.fnUntraced(function* (engine: HostStoryEngine) {
	const daemon = yield* diagnosticsDaemon(
		() => {
			throw new Error("This Fleet connection serves items only");
		},
		0,
		engine.running.client("daemon.fleetItems", {}).pipe(
			Effect.map((data) => ({
				completed: data.completed,
				items: data.items.map(({ execution: _execution, ...item }) => item),
			})),
			Effect.orDie,
		),
	);
	return yield* boardHttp(engine.fixture.host.boardDir, undefined, undefined, daemon.port);
});
