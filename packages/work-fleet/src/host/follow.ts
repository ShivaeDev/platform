import { Effect, Stream } from "effect";
import { DAEMON_PORT } from "@shivaedev/work-board/diagnostics/daemonContract.ts";
import { type FleetError, isFleetError } from "#errors.ts";
import { daemonClient, daemonError } from "#host/daemonClient.ts";
import type { State } from "#host/waitOutcome.ts";

export interface FollowOptions {
	readonly intervalMs: number;
	readonly port?: number;
	readonly timeoutMs?: number;
}

export function follow(options: FollowOptions, workIds: readonly string[]) {
	const port = options.port ?? DAEMON_PORT;
	let ids = workIds;
	let connected = false;
	let failures = 0;
	function connect(): Stream.Stream<readonly (typeof State.Type)[], FleetError> {
		return Stream.unwrap(daemonClient(port).pipe(Effect.map((client) => client("daemon.follow", { workIds: ids })))).pipe(
			Stream.scoped,
			Stream.map((states) => {
				if (!connected && ids.length === 0) {
					ids = states.map((state) => state.workId);
				}
				connected = true;
				failures = 0;
				return states;
			}),
			Stream.concat(Stream.fail(new Error("Fleet daemon subscription closed"))),
			Stream.catch((error) => {
				failures += 1;
				if (!connected || isFleetError(error) || failures >= 20) {
					return Stream.fail(daemonError(error, port));
				}
				return Stream.unwrap(Effect.sleep(options.intervalMs).pipe(Effect.as(connect())));
			}),
		);
	}
	return connect();
}
