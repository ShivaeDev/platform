import { Buffer } from "node:buffer";
import { basename, join } from "node:path";
import { Effect, FileSystem, type PlatformError, Schema } from "effect";
import { MIGRATION_FILE_PATTERN } from "@shivaedev/sql/migrationConvention.ts";
import { CreateAppError } from "#CreateAppError.ts";
import { prepareFile, prepareManifest, type Template, Versions } from "#template.ts";

const appPaths = new Map([
	["app-agents.md", "AGENTS.md"],
	["app-readme.md", "README.md"],
	["pnpm-workspace.copy.yaml", "pnpm-workspace.yaml"],
]);
const excluded = new Set(["node_modules", "dist", "coverage", "pnpm-lock.yaml", ".git"]);
const rootExcluded = new Set(["published-versions.json", "AGENTS.md", "CLAUDE.md", "README.md", "quality.config.ts"]);
function included(path: string) {
	return !(rootExcluded.has(path) || excluded.has(basename(path))) && (!basename(path).startsWith(".env") || basename(path) === ".env.example");
}

export const packTemplate = Effect.fn("CreateApp.packTemplate")(function* (starter: string, output: string) {
	const fs = yield* FileSystem.FileSystem;
	const versions = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Versions))(
		yield* fs.readFileString(join(starter, "published-versions.json")),
	);
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
				const source = Buffer.from(yield* fs.readFile(join(starter, path)));
				const content = yield* Effect.try({
					catch: (cause) => new CreateAppError({ message: String(cause) }),
					try: () => prepareFile(path, source, versions),
				});
				entries.push({ content: content.toString("base64"), path: target });
			}
		}
	});
	yield* visit("");
	const manifest = entries.find((entry) => entry.path === "package.json");
	if (manifest !== undefined) {
		const minimal = yield* Effect.try({
			catch: (cause) => new CreateAppError({ message: String(cause) }),
			try: () => prepareManifest(Buffer.from(manifest.content, "base64").toString(), versions, true),
		});
		entries.push({ content: Buffer.from(minimal).toString("base64"), path: "package.minimal.json" });
	}
	yield* fs.writeFileString(output, `${JSON.stringify(entries)}\n`);
});
