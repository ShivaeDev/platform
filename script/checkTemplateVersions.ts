import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Schema } from "effect";
import { command } from "#package-check/io.ts";
import { decodeVersions } from "#package-check/model.ts";
import { checkVersions } from "#starter-published/checkVersions.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const decodeVersion = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ version: Schema.String })));
const decodeLatest = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.String));
const decodePublished = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Array(Schema.String)));

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	if (process.argv.includes("--release")) {
		const current = decodeVersion(yield* fs.readFileString(`${root}/packages/create-app/package.json`));
		const published = decodePublished(
			yield* command(root, "pnpm", ["view", "@shivaedev/create-app", "versions", "--json", "--registry=https://registry.npmjs.org"]),
		);
		if (published.includes(current.version)) {
			yield* Effect.log("No create-app release; template version check is not needed.");
			return;
		}
	}
	const pins = decodeVersions(yield* fs.readFileString(`${root}/examples/starter/published-versions.json`));
	const workspace: Record<string, string> = {};
	for (const name of Object.keys(pins)) {
		workspace[name] = decodeVersion(yield* fs.readFileString(`${root}/packages/${name.replace("@shivaedev/", "")}/package.json`)).version;
	}
	yield* checkVersions(
		pins,
		(name) =>
			command(root, "pnpm", ["view", `${name}@latest`, "version", "--json", "--registry=https://registry.npmjs.org"]).pipe(Effect.map(decodeLatest)),
		workspace,
	);
	yield* Effect.log("Every generated app framework pin matches npm latest or a newer workspace release.");
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
