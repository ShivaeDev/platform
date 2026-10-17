import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Schema } from "effect";
import { decodeVersions } from "#package-check/model.ts";
import { checkPins, latestVersion } from "#starter-published/versions.ts";

const manifest = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ name: Schema.String, version: Schema.String })));
const root = dirname(fileURLToPath(new URL(import.meta.url)));
const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const repository = dirname(root);
	const generator = manifest(yield* fs.readFileString(join(repository, "packages/create-app/package.json")));
	if (generator.version === (yield* latestVersion(repository, generator.name))) {
		yield* Effect.log("The generated app command is already published; no release pins to check.");
		return;
	}
	const pins = decodeVersions(yield* fs.readFileString(join(repository, "examples/starter/published-versions.json")));
	const workspace: Record<string, string> = {};
	for (const name of Object.keys(pins)) {
		const pkg = manifest(yield* fs.readFileString(join(repository, "packages", name.replace("@shivaedev/", ""), "package.json")));
		workspace[pkg.name] = pkg.version;
	}
	yield* checkPins(pins, workspace, (name) => latestVersion(repository, name));
	yield* Effect.log("Generated app dependency pins match npm latest or the workspace release candidate.");
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
