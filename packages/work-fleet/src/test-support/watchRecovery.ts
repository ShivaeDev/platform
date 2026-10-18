import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Layer, Stream } from "effect";
import { HttpServer } from "effect/http";
import { RpcGroup } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { appHost } from "@shivaedev/platform/server/appHost.ts";
import { Follow, RPC_PATH } from "#host/daemonContract.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import type { State } from "#host/waitOutcome.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

export type RecoverySnapshots = readonly (readonly (typeof State.Type)[])[];

export const watchRecovery = Effect.fn("FleetStory.watchRecovery")(function* (follow: boolean, recorded?: RecoverySnapshots) {
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
	return yield* Effect.promise(() => cliProcess(["watch", "one", ...(follow ? ["--follow"] : []), "--timeout", "0.1", "--port", port]));
}, Effect.scoped);
