import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import type { Package } from "#package-check/model.ts";

const Scenario = Schema.Struct({
	entries: Schema.Array(Schema.String),
	fixtures: Schema.Array(Schema.String),
	run: Schema.Array(Schema.String),
	omitOptionalPeers: Schema.Boolean,
	tsconfig: Schema.optional(Schema.String),
});
export type Scenario = typeof Scenario.Type;
const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Array(Scenario))));
export const scenarios = (root: string, pkg: Package) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const config = decode(yield* fs.readFileString(join(root, "script/package-check/consumer-cases.json")));
		return config[pkg.directory.split("/").at(-1) ?? ""] ?? [];
	});
