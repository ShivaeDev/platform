import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, Stream } from "effect";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { type FleetError, isFleetError } from "#errors.ts";
import { daemonClient, daemonError } from "#host/daemonClient.ts";
import { readDaemonPort } from "#host/daemonPort.ts";
import { decodeFollowState, type FollowState } from "#host/followState.ts";

export interface FollowOptions {
	readonly board?: string;
	readonly follow?: boolean;
	readonly intervalMs: number;
	readonly port?: number;
	readonly timeoutMs?: number;
}

export function follow(options: FollowOptions, workIds: readonly string[]) {
	let port = options.port ?? 0;
	let ids = workIds;
	let connected = false;
	let failures = 0;
	function connect(): Stream.Stream<readonly FollowState[], FleetError> {
		return Stream.unwrap(
			Effect.gen(function* () {
				port = yield* readDaemonPort(options.board ?? ".work", options.port).pipe(Effect.provide(NodeServices.layer));
				const client = yield* daemonClient(port);
				return client("daemon.follow", { follow: options.follow, workIds: ids });
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
				if (options.follow && !isFleetError(error) && (!(error instanceof RpcClientError) || error.reason._tag === "HttpError")) {
					return Stream.unwrap(
						Console.error(`work-fleet: ERROR ${daemonError(error, port, "follow").message}; retrying in ${options.intervalMs / 1000}s`).pipe(
							Effect.andThen(Effect.sleep(options.intervalMs)),
							Effect.as(connect()),
						),
					);
				}
				if (!connected || isFleetError(error) || failures >= 20) {
					return Stream.fail(daemonError(error, port, "follow"));
				}
				return Stream.unwrap(Effect.sleep(options.intervalMs).pipe(Effect.as(connect())));
			}),
		);
	}
	return connect();
}
