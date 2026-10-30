import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Effect, FileSystem, Order, Schema } from "effect";
import type { ChangesetConfig } from "#config.ts";
import { ChangesetError } from "#error.ts";
import { PackageManifest, type Source, type WorkspacePackage } from "#model.ts";
export function packagePatterns(config: ChangesetConfig): readonly string[] {
	return config.packages ?? ["packages/*", "examples/*"];
}
const Json = Schema.Record(Schema.String, Schema.Unknown);
export const decodePackage = Effect.fn("Changesets.decodePackage")(function* (directory: string, text: string, changelog: string) {
	const json = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Json))(text).pipe(
		Effect.mapError((cause) => new ChangesetError({ cause, message: cause.message })),
	);
	const manifest = yield* Schema.decodeUnknownEffect(PackageManifest)(json).pipe(
		Effect.mapError((cause) => new ChangesetError({ cause, message: cause.message })),
	);
	return { changelog, directory, json, manifest } satisfies WorkspacePackage;
});
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
	if (typeof module.default !== "object" || module.default === null) {
		return yield* new ChangesetError({ message: ".changeset/changesets.config.ts: export a config object with defineConfig." });
	}
	if (
		module.default.hooks !== undefined
		&& !(Array.isArray(module.default.hooks) && module.default.hooks.every((hook) => typeof hook === "function"))
	) {
		return yield* new ChangesetError({ message: ".changeset/changesets.config.ts: hooks must be Effect functions, not shell strings." });
	}
	if (
		module.default.packages !== undefined
		&& !(Array.isArray(module.default.packages) && module.default.packages.every((pattern) => typeof pattern === "string"))
	) {
		return yield* new ChangesetError({ message: ".changeset/changesets.config.ts: packages must be directory paths or parent/* patterns." });
	}
	return module.default;
});
const directories = Effect.fn("Changesets.directories")(function* (root: string, pattern: string) {
	const fs = yield* FileSystem.FileSystem;
	if (!/^(?:[\w.-]+\/)*[\w.*-]+$/u.test(pattern) || pattern.split("/").includes("..") || (pattern.includes("*") && !pattern.endsWith("/*"))) {
		return yield* new ChangesetError({ message: `Invalid package pattern ${pattern}; use a relative directory or parent/*. ` });
	}

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
			packages.push(yield* decodePackage(directory, text, changelog));
		}
	}
	if (new Set(packages.map((pkg) => pkg.manifest.name)).size !== packages.length) {
		return yield* new ChangesetError({ message: "Workspace package names must be unique; fix package.json names." });
	}

	return { changesets: yield* readChangesets(root), packages };
});
