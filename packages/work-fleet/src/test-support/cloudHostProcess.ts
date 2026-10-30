import { dirname } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { productionParts } from "#host/commands.ts";
import { loadHost } from "#host/configFile.ts";
import { serveFleet } from "#host/daemon.ts";
import { reportBoard } from "#host/reportBoard.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { fixedMainSource } from "#test/mainSource.ts";
import { pausePublication } from "#test/pausePublication.ts";
import { unpublishedHostIntegrations } from "#test/unpublishedHostIntegrations.ts";

const configFile = process.argv[2];
if (configFile === undefined) {
	throw new Error("A synthetic host config is required");
}
if (process.argv.includes("pause-publication")) {
	pausePublication();
}
await Effect.runPromise(
	Effect.gen(function* () {
		const host = yield* loadHost(dirname(configFile), configFile);
		const parts = {
			...productionParts(host),
			github: syntheticGithub().layer,
			integrations: unpublishedHostIntegrations(host),
			main: fixedMainSource(),
			...(process.argv.includes("report")
				? {
						board: reportBoard(
							host.boardDir,
							() => Effect.succeed(false),
							() => Effect.succeed({ files: [], unavailable: [] }),
						).pipe(Layer.provide(markdownBoard(host.boardDir)), Layer.provide(NodeServices.layer)),
					}
				: {}),
		};
		return yield* serveFleet(host, parts, 0);
	}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
