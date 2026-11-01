import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Effect, Schedule } from "effect";
import { trimPostgresPageCache } from "@shivaedev/server/trimPostgresPageCache.ts";

const trim = Effect.gen(function* () {
	const dataDirectory = yield* Config.String("PGDATA");
	yield* trimPostgresPageCache(dataDirectory).pipe(Effect.repeat(Schedule.spaced("5 minutes")));
});

NodeRuntime.runMain(trim.pipe(Effect.provide(NodeServices.layer)));
