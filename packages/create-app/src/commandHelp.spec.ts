import { Effect, FileSystem, Path, Schema } from "effect";
import { expect } from "vitest";
import { application } from "#test/application.ts";

const decodeManifest = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Struct({ version: Schema.String })));

const packageVersion = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const { version } = yield* decodeManifest(yield* fs.readFileString(yield* path.fromFileUrl(new URL("../package.json", import.meta.url))));
	return version;
});

application.it(
	"create-app --help describes the command, the optional folder, the --minimal flag and the update and resource subcommands without a packed template",
	[],
	function* ({ help }) {
		expect(yield* help()).toEqual(
			expect.arrayContaining([
				"Create and install a Platform application from the maintained starter.",
				"create-app <subcommand> [flags] [<folder>]",
				"folder string (optional)",
				"--minimal Create the starter without the notes example module.",
				"update",
				"resource Add an authenticated resource and register it in this app's server module list.",
			]),
		);
	},
);

application.it("create-app --version prints the package version without a packed template", [], function* ({ version: printedVersion }) {
	const version = yield* packageVersion;

	expect(yield* printedVersion()).toBe(`create-app v${version}`);
});
