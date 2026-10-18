import { Effect, Option, Sink, Stream } from "effect";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/integration/diagnostics.ts";
import { type FleetError, isFleetError } from "#errors.ts";
import { daemonClient, daemonError } from "#host/daemonClient.ts";
import { decodeFollowState, type FollowState } from "#host/followState.ts";

const { DAEMON_PORT } = diagnosticsApi;

export interface FollowOptions {
	readonly follow?: boolean;
	readonly intervalMs: number;
	readonly port?: number;
	readonly timeoutMs?: number;
}

export function follow(options: FollowOptions, workIds: readonly string[]) {
	const port = options.port ?? DAEMON_PORT;
	let ids = workIds;
	let connected = false;
	let failures = 0;
	function connect(): Stream.Stream<readonly FollowState[], FleetError> {
		return Stream.unwrap(
			Effect.gen(function* () {
				const client = yield* daemonClient(port);
				const [first, rest] = yield* client("daemon.follow", { follow: options.follow, workIds: ids }).pipe(
					Stream.peel(Sink.head<readonly unknown[]>()),
					Effect.timeout("5 seconds"),
				);
				return Stream.concat(Stream.fromIterable(Option.toArray(first)), rest);
			}),
		).pipe(
			Stream.scoped,
			Stream.map((states) => states.map(decodeFollowState)),
			Stream.map((states) => {
				if (!(options.follow || connected) && ids.length === 0) {
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
					return Stream.fail(daemonError(error, port, "follow"));
				}
				return Stream.unwrap(Effect.sleep(options.intervalMs).pipe(Effect.as(connect())));
			}),
		);
	}
	return connect();
}
