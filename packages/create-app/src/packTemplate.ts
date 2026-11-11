import { basename, join } from "node:path";
import { Effect, FileSystem, type PlatformError, Schema } from "effect";
import * as Base64 from "effect/encoding/Base64";
import { MIGRATION_FILE_PATTERN } from "@shivaedev/sql/migration.ts";
import { CreateAppError } from "#CreateAppError.ts";
import { bytesOf, textOf } from "#fileContent.ts";
import { prepareFile, prepareManifest, type Template, Versions } from "#template.ts";

const appPaths = new Map([
	["app-agents.md", "AGENTS.md"],
	["app-readme.md", "README.md"],
	["pnpm-workspace.copy.yaml", "pnpm-workspace.yaml"],
]);
const excluded = new Set(["node_modules", "dist", "coverage", "test-results", ".browser-check", "pnpm-lock.yaml", ".git"]);
const rootExcluded = new Set(["published-versions.json", "AGENTS.md", "CLAUDE.md", "README.md", ".agents", ".claude"]);
const GENERATED = "src/generated/";
function included(path: string) {
	return (
		!(rootExcluded.has(path) || excluded.has(basename(path)))
		&& (!basename(path).startsWith(".env") || basename(path) === ".env.example")
		&& (!path.startsWith(GENERATED) || path === `${GENERATED}README.md`)
	);
}

export const packTemplate = Effect.fn("CreateApp.packTemplate")(function* (starter: string, output: string) {
	const fs = yield* FileSystem.FileSystem;
	const versions = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Versions))(
		yield* fs.readFileString(join(starter, "published-versions.json")),
	);
	const workspace = join(starter, "pnpm-workspace.copy.yaml");
	const cataloged = (yield* fs.exists(workspace)) && /^(?<quote>["']?)(?:catalog|catalogs)\k<quote>\s*:/mu.test(yield* fs.readFileString(workspace));
	const entries: Template[number][] = [];
	const visit = Effect.fn("CreateApp.visit")(function* (directory: string): Effect.fn.Return<void, PlatformError.PlatformError | CreateAppError> {
		for (const name of (yield* fs.readDirectory(join(starter, directory))).sort()) {
			const path = join(directory, name);
			if (!included(path)) {
				continue;
			}
			if ((yield* fs.stat(join(starter, path))).type === "Directory") {
				yield* visit(path);
			} else {
				if (basename(directory) === "migrations" && !MIGRATION_FILE_PATTERN.test(name)) {
					return yield* new CreateAppError({ message: `Invalid migration filename: ${path}` });
				}
				const target = appPaths.get(path) ?? path;
				const source = yield* fs.readFile(join(starter, path));
				const content = yield* prepareFile(path, source, versions, cataloged).pipe(
					Effect.mapError((cause) => new CreateAppError({ message: `Failed to prepare template file ${path}` }, { cause })),
				);
				entries.push({ content: Base64.encode(content), path: target });
			}
		}
	});
	yield* visit("");
	const manifest = entries.find((entry) => entry.path === "package.json");
	if (manifest !== undefined) {
		const minimal = yield* Effect.fromResult(Base64.decode(manifest.content)).pipe(
			Effect.flatMap((bytes) => prepareManifest(textOf(bytes), versions, true, cataloged)),
			Effect.mapError((cause) => new CreateAppError({ message: "Failed to prepare minimal template file package.minimal.json" }, { cause })),
		);
		entries.push({ content: Base64.encode(bytesOf(minimal)), path: "package.minimal.json" });
	}
	yield* fs.writeFileString(output, `${JSON.stringify(entries)}\n`);
});
