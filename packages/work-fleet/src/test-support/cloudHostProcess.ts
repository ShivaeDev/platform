import { dirname } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Layer, Stream, SubscriptionRef } from "effect";
import { ChangeObserver } from "@shivaedev/sql/transact.ts";
import { SchedulerPasses } from "#engine/health.ts";
import { productionParts } from "#host/commands.ts";
import { loadHost } from "#host/configFile.ts";
import { daemonLayer } from "#host/daemon.ts";
import { reportBoard } from "#host/reportBoard.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { liveBoard } from "#test/liveBoard.ts";
import { fixedMainSource } from "#test/mainSource.ts";
import { pausePublication } from "#test/pausePublication.ts";
import { unpublishedHostIntegrations } from "#test/unpublishedHostIntegrations.ts";

function notify(message: string) {
	return Effect.sync(() => {
		process.send?.(message);
	});
}

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
						).pipe(Layer.provide(liveBoard(host.boardDir)), Layer.provide(NodeServices.layer)),
					}
				: {}),
		};
		const observed = Layer.succeed(ChangeObserver, (event) => (event._tag === "Published" ? notify("committed") : Effect.void));
		const context = yield* Layer.build(daemonLayer(host, parts, 0).pipe(Layer.provide(observed)));
		return yield* SubscriptionRef.changes(Context.get(context, SchedulerPasses)).pipe(Stream.runForEach(() => notify("scheduler-pass")));
	}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
