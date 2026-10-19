import { connect } from "node:net";
import { Deferred, Effect, Fiber, Layer, Stream } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { discoveryDaemon } from "#test/discoveryDaemon.ts";
import { hostFixture } from "#test/fleetHost.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";

function acceptsConnections(port: number) {
	return Effect.promise(
		() =>
			new Promise<boolean>((resolve, reject) => {
				const socket = connect({ host: "127.0.0.1", port });
				socket.once("connect", () => {
					socket.destroy();
					resolve(true);
				});
				socket.once("error", (error) => {
					socket.destroy();
					if ("code" in error && error.code === "ECONNREFUSED") {
						resolve(false);
					} else {
						reject(error);
					}
				});
			}),
	);
}

export const daemonStartup = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const fixture = yield* hostFixture();
		const previous = yield* discoveryDaemon(fixture);
		yield* previous.close;
		const entered = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const building = yield* Layer.build(
			readDaemonLayer(fixture.host, {
				beforeHandlers: Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release))),
				parts: fixture.parts,
				port: previous.port,
			}),
		).pipe(Effect.forkScoped);
		yield* Deferred.await(entered);
		return { building, port: previous.port, release };
	},
	inspect: (engine) => ({ port: engine.port }),
	layer: postgresLayer,
	name: "Fleet daemon startup",
	runIf: postgresEnabled,
	stages: ["startup"],
	verbs: (engine, story) => ({
		acceptsConnections: () => acceptsConnections(engine.port),
		resume: () => {
			story.tell("finish building the replacement daemon's handlers");
			return Deferred.succeed(engine.release, undefined).pipe(Effect.andThen(Fiber.join(engine.building)));
		},
		snapshot: () =>
			Effect.scoped(
				daemonClient(engine.port).pipe(Effect.flatMap((client) => client("daemon.follow", { workIds: [] }).pipe(Stream.take(1), Stream.runCollect))),
			),
	}),
});
