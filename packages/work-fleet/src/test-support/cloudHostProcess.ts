import { dirname } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { productionParts } from "#host/commands.ts";
import { loadHost } from "#host/configFile.ts";
import { serveFleet } from "#host/daemon.ts";
import { fixedMainSource } from "#test/mainSource.ts";

const configFile = process.argv[2];
if (configFile === undefined) {
	throw new Error("A synthetic host config is required");
}
await Effect.runPromise(
	Effect.gen(function* () {
		const host = yield* loadHost(dirname(configFile), configFile);
		const parts = {
			...productionParts(host),
			main: fixedMainSource(),
		};
		return yield* serveFleet(host, parts, 0);
	}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
