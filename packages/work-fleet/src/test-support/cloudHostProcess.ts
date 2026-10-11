import { dirname } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { productionParts, runFleet } from "#host/commands.ts";
import { loadHost } from "#host/config.ts";
import { serveFleet } from "#host/daemon.ts";
import { MainSource, unchanged } from "#host/mainSource.ts";
import { MAIN } from "#test/fleetHost.ts";

const configFile = process.argv[2];
if (configFile === undefined) {
	throw new Error("A synthetic host config is required");
}
await Effect.runPromise(
	Effect.gen(function* () {
		const host = yield* loadHost(dirname(configFile), configFile);
		const parts = {
			...productionParts(host),
			main: Layer.succeed(MainSource)({
				current: Effect.succeed(MAIN),
				observe: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, MAIN)),
				refresh: Effect.succeed(MAIN),
				repositoryRoot: "/synthetic-repository",
			}),
		};
		if (process.argv[3] === "daemon") {
			return yield* serveFleet(host, parts, 0);
		}
		return yield* runFleet(host, parts);
	}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
