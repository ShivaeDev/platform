import { Effect, Option } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { configuredTimeout } from "#expiry.ts";
import type { bindingIsolation } from "./bindingIsolation.ts";
import { connect } from "./database.ts";
import type { PostgresEngine, PostgresOptions } from "./postgresEngine.ts";
import { postgresVerbs } from "./postgresVerbs.ts";
import { writeEngine } from "./writeEngine.ts";

export const prisma = storyKit({
	clock: "live",
	create: () => {
		const options: PostgresOptions = {};
		return {
			bindings: Option.none<Effect.Success<ReturnType<typeof bindingIsolation>>>(),
			database: Option.none<PostgresEngine>(),
			options,
			other: Option.none<{ client: PostgresEngine["client"]; changes: PostgresEngine["changes"] }>(),
			recording: writeEngine(),
		};
	},
	inspect: (engine) => ({
		postgres: Option.map(engine.database, ({ checked, schema, published, unnamed, seen }) => ({ checked, published, schema, seen, unnamed })),
		recording: { published: engine.recording.published, unnamed: engine.recording.unnamed },
	}),
	name: "Prisma changes",
	stages: ["configuration", "database", "fixtures"],
	verbs: (engine, story) => ({
		bindings: {
			get client() {
				return Option.getOrThrow(engine.bindings).client;
			},
			get clientFromOtherCopy() {
				return Option.getOrThrow(engine.bindings).clientFromOtherCopy;
			},
		},
		clientTimeouts: Effect.gen(function* () {
			const configured = yield* connect("public", { timeout: 1234 });
			const defaults = yield* connect("public");
			return [configuredTimeout(configured), configuredTimeout(configured.$extends({})), configuredTimeout(defaults)];
		}),
		database: postgresVerbs(
			() => Option.getOrThrow(engine.database),
			story.tell,
			() => Option.getOrThrow(engine.other),
		),
		recording: {
			...engine.recording,
			record: (...args: Parameters<typeof engine.recording.record>) => {
				story.tell(`the application records ${args[0]}.${args[1]}`);
				return engine.recording.record(...args);
			},
		},
	}),
});
