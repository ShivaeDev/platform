import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Layer, Stream } from "effect";
import { HttpServer } from "effect/http";
import { RpcGroup } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { withLive } from "@shivaedev/test/withLive.ts";
import { Follow, RPC_PATH } from "#host/daemonContract.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import type { State } from "#host/waitOutcome.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { untilOutput } from "#test/follower.ts";
import { followerProcess } from "#test/followerProcess.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

export type RecoverySnapshots = readonly (readonly (typeof State.Type)[])[];

export const watchRecovery = Effect.fn("FleetStory.watchRecovery")(
	function* (follow: boolean, expected: string, recorded?: RecoverySnapshots) {
		const sql = yield* SqlClient.SqlClient;
		const snapshots = readWaitStates({ namespace: STORAGE_NAMESPACE }).pipe(
			Effect.provideService(SqlClient.SqlClient, sql),
			Effect.mapError(() => new ServiceUnavailable({ message: "Cannot read Fleet snapshots" })),
		);
		const group = RpcGroup.make(Follow);
		const context = yield* Layer.build(
			appHost({
				config: { host: "127.0.0.1", port: 0 },
				group,
				handlers: group.toLayer({
					"daemon.follow": () =>
						(recorded === undefined ? Stream.fromEffect(snapshots) : Stream.fromIterable(recorded)).pipe(Stream.concat(Stream.never)),
				}),
				policy: "loopback",
				rpcPath: RPC_PATH,
				services: Layer.empty,
			}).pipe(Layer.provide(NodeServices.layer)),
		);
		const server = Context.get(context, HttpServer.HttpServer);
		const port = new URL(HttpServer.formatAddress(server.address)).port;
		if (!follow) {
			return (yield* Effect.promise(() => cliProcess(["watch", "one", "--timeout", "0.1", "--port", port]))).stdout;
		}
		const watcher = yield* followerProcess(".work/fleet.json", "watch", ["one"], { follow: true, port: Number(port) });
		yield* untilOutput(watcher, expected);
		return watcher.output().trim();
	},
	Effect.scoped,
	withLive,
);
