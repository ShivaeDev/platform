import { join } from "node:path";
import process from "node:process";
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { Config, Console, Effect, FileSystem, Schema } from "effect";
import { checkRepository } from "@shivaedev/changesets/check.ts";
import { ChangesetError } from "@shivaedev/changesets/error.ts";
import type { PackageManifest } from "@shivaedev/changesets/model.ts";
import { readWorkspace } from "@shivaedev/changesets/workspace.ts";
import config from "#release-config";

const Versions = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

const checkDependencyPins = Effect.fn("Release.checkDependencyPins")(function* (
	manifest: PackageManifest,
	published: ReadonlyMap<string, PackageManifest>,
	pins: Readonly<Record<string, string>>,
) {
	for (const [dependency, version] of Object.entries({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies })) {
		const target = published.get(dependency);
		if (target === undefined) {
			continue;
		}
		const expected = version === "workspace:*" ? target.version : version.replace(/^workspace:/u, "");
		if (pins[dependency] !== expected) {
			return yield* new ChangesetError({
				message: `Starter published-versions.json: ${manifest.name}@${manifest.version} depends on ${dependency}@${expected}, but its pin is ${pins[dependency] ?? "missing"}. Align the dependency release and starter pin, then release create-app.`,
			});
		}
	}
});

const checkStarterPins = Effect.fn("Release.checkStarterPins")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const pins = yield* Schema.decodeUnknownEffect(Versions)(yield* fs.readFileString(join(root, "examples/starter/published-versions.json"))).pipe(
		Effect.mapError(
			(cause) => new ChangesetError({ cause, message: "Fix examples/starter/published-versions.json to map package names to versions." }),
		),
	);
	const workspace = yield* readWorkspace(root, config);
	const published = new Map(workspace.packages.filter((pkg) => !pkg.manifest.private).map((pkg) => [pkg.manifest.name, pkg.manifest]));
	for (const [name, pin] of Object.entries(pins)) {
		const manifest = published.get(name);
		if (manifest === undefined || pin !== manifest.version) {
			return yield* new ChangesetError({
				message: `Starter published-versions.json: ${name}@${pin} must pin the current release ${manifest?.version ?? "of a published workspace package"}. Align the pin and release create-app.`,
			});
		}
		yield* checkDependencyPins(manifest, published, pins);
	}
});

export const checkPlatform = Effect.fn("Release.checkPlatform")(function* (root: string, reference?: string) {
	const fs = yield* FileSystem.FileSystem;
	for (const name of yield* fs.readDirectory(join(root, "packages"))) {
		const directory = join(root, "packages", name, "changes");
		if (!(yield* fs.exists(directory))) {
			continue;
		}
		for (const fragment of yield* fs.readDirectory(directory)) {
			if (fragment.endsWith(".md")) {
				return yield* new ChangesetError({
					message: `Move packages/${name}/changes/${fragment} to .changeset/<short-name>.md with package names and explicit bumps in YAML frontmatter.`,
				});
			}
		}
	}
	yield* checkStarterPins(root);
	yield* checkRepository(root, config, reference);
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			const reference = yield* Config.String("CHANGELOG_BASE_REF").pipe(Config.withDefault(undefined));
			yield* checkPlatform(process.cwd(), process.argv[2] ?? reference);
			yield* Console.log("Changesets and release notes are valid.");
		}).pipe(
			Effect.tapError((error) => Console.error(error.message)),
			Effect.provide(NodeFileSystem.layer),
		),
		{ disableErrorReporting: true },
	);
}
