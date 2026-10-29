import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Effect, FileSystem, Order, Schema } from "effect";
import type { ChangesetConfig } from "#config.ts";
import { attempt, ChangesetError, requireThat } from "#error.ts";
import { PackageManifest, type Source, type WorkspacePackage } from "#model.ts";
export function packagePatterns(config: ChangesetConfig): readonly string[] {
	return config.packages ?? ["packages/*", "examples/*"];
}
const Json = Schema.Record(Schema.String, Schema.Unknown);
export function decodePackage(directory: string, text: string, changelog: string): WorkspacePackage {
	return {
		changelog,
		directory,
		json: Schema.decodeUnknownSync(Schema.fromJsonString(Json))(text),
		manifest: Schema.decodeUnknownSync(Schema.fromJsonString(PackageManifest))(text),
	};
}
export const readOptional = Effect.fn("Changesets.readOptional")(function* (path: string, fallback: string) {
	const fs = yield* FileSystem.FileSystem;
	return (yield* fs.exists(path)) ? yield* fs.readFileString(path) : fallback;
});
export const loadConfig = Effect.fn("Changesets.loadConfig")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = join(root, ".changeset/changesets.config.ts");
	if (!(yield* fs.exists(path))) {
		return {} satisfies ChangesetConfig;
	}
	const module: {
		default: ChangesetConfig;
	} = yield* Effect.tryPromise({
		catch: (cause) =>
			new ChangesetError({
				cause,
				message: ".changeset/changesets.config.ts: export default defineConfig({ packages, hooks }); hooks must be typed Effect functions.",
			}),
		try: () => import(pathToFileURL(path).href),
	});
	yield* attempt(() => {
		requireThat(
			typeof module.default === "object" && module.default !== null,
			".changeset/changesets.config.ts: export a config object with defineConfig.",
		);
		requireThat(
			module.default.hooks === undefined || (Array.isArray(module.default.hooks) && module.default.hooks.every((hook) => typeof hook === "function")),
			".changeset/changesets.config.ts: hooks must be Effect functions, not shell strings.",
		);
		requireThat(
			module.default.packages === undefined
				|| (Array.isArray(module.default.packages) && module.default.packages.every((pattern) => typeof pattern === "string")),
			".changeset/changesets.config.ts: packages must be directory paths or parent/* patterns.",
		);
	});
	return module.default;
});
const directories = Effect.fn("Changesets.directories")(function* (root: string, pattern: string) {
	const fs = yield* FileSystem.FileSystem;
	yield* attempt(() =>
		requireThat(
			/^(?:[\w.-]+\/)*[\w.*-]+$/u.test(pattern) && !pattern.split("/").includes("..") && (!pattern.includes("*") || pattern.endsWith("/*")),
			`Invalid package pattern ${pattern}; use a relative directory or parent/*. `,
		),
	);
	if (!pattern.endsWith("/*")) {
		return [pattern];
	}
	const parent = pattern.slice(0, -2);
	return (yield* fs.exists(join(root, parent))) ? (yield* fs.readDirectory(join(root, parent))).map((name) => `${parent}/${name}`) : [];
});
export const readChangesets = Effect.fn("Changesets.readChangesets")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const directory = join(root, ".changeset");
	const names = (yield* fs.exists(directory)) ? yield* fs.readDirectory(directory) : [];
	return yield* Effect.forEach(names.filter(isChangeset).sort(Order.String), (name) =>
		Effect.map(fs.readFileString(join(directory, name)), (text): Source => ({ name, text })),
	);
});
export function isChangeset(name: string): boolean {
	return name !== "README.md" && /^[^/\\]+\.md$/u.test(name);
}
export const readWorkspace = Effect.fn("Changesets.readWorkspace")(function* (root: string, config: ChangesetConfig) {
	const fs = yield* FileSystem.FileSystem;
	const paths = [...new Set((yield* Effect.forEach(packagePatterns(config), (pattern) => directories(root, pattern))).flat())].sort(Order.String);
	const packages: WorkspacePackage[] = [];
	for (const directory of paths) {
		if (yield* fs.exists(join(root, directory, "package.json"))) {
			const text = yield* fs.readFileString(join(root, directory, "package.json"));
			const changelog = yield* readOptional(join(root, directory, "CHANGELOG.md"), "# Changelog\n");
			packages.push(yield* attempt(() => decodePackage(directory, text, changelog)));
		}
	}
	yield* attempt(() =>
		requireThat(
			new Set(packages.map((pkg) => pkg.manifest.name)).size === packages.length,
			"Workspace package names must be unique; fix package.json names.",
		),
	);
	return { changesets: yield* readChangesets(root), packages };
});
