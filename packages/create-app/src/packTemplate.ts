import { Buffer } from "node:buffer";
import { basename, join } from "node:path";
import { Effect, FileSystem, type PlatformError, Schema } from "effect";
import { CreateAppError } from "#CreateAppError.ts";
import { prepareFile, type Template, Versions } from "#template.ts";

const excluded = new Set(["node_modules", "dist", "coverage", "pnpm-lock.yaml", ".git"]);
function included(path: string) {
	return !excluded.has(basename(path)) && (!basename(path).startsWith(".env") || basename(path) === ".env.example");
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
				const target = path === "pnpm-workspace.copy.yaml" ? "pnpm-workspace.yaml" : path;
				const source = Buffer.from(yield* fs.readFile(join(starter, path)));
				const content = yield* Effect.try({
					catch: (cause) => new CreateAppError({ message: String(cause) }),
					try: () =>
						[
							"biome.json",
							"package.json",
							"tsconfig.json",
							"vite.config.ts",
							"vitest.config.ts",
							"src/server/dev.ts",
							"src/test-support/deployChild.ts",
						].includes(path)
							? Buffer.from(prepareFile(path, source.toString(), versions))
							: source,
				});
				entries.push({ content: content.toString("base64"), path: target });
			}
		}
	});
	yield* visit("");
	yield* fs.writeFileString(output, `${JSON.stringify(entries)}\n`);
});
