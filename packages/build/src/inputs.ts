import { Effect, FileSystem, Option, Path } from "effect";
import { Digest } from "effect/crypto";
import { type ProjectConfig, resolvedImports, typeScriptVersion } from "#adapters/typeScript.ts";
import { byText } from "#byText.ts";
import packageInfo from "#package.json" with { type: "json" };

const LOCKFILES = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock"];

export interface Project {
	readonly config: ProjectConfig;
	readonly generated: string;
	readonly generator: string;
	readonly root: string;
}

const lockfileOf = Effect.fn("Build.lockfileOf")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	for (let directory = root; ; directory = path.dirname(directory)) {
		for (const name of LOCKFILES) {
			if (yield* fs.exists(path.join(directory, name))) {
				return Option.some(path.join(directory, name));
			}
		}
		if (path.dirname(directory) === directory) {
			return Option.none<string>();
		}
	}
});

// The generator's own code, so a changed generator rewrites every file even before its version changes.
export const generatorFingerprint = Effect.fn("Build.generatorFingerprint")(function* () {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const digest = yield* Digest.Digest;
	const directory = yield* path.fromFileUrl(new URL(".", import.meta.url));
	const files = (yield* fs.readDirectory(directory, { recursive: true })).sort();
	const texts = yield* Effect.forEach(files, (file) =>
		Effect.gen(function* () {
			const full = path.join(directory, file);
			const info = yield* fs.stat(full);
			return info.type === "File" ? `${file}\u0000${yield* fs.readFileString(full)}` : "";
		}),
	);
	const versions = `@shivaedev/build ${packageInfo.version}, typescript ${typeScriptVersion}`;
	return yield* digest.digestHex(Digest.sha256, new TextEncoder().encode([versions, ...texts].join("\u0001")));
});

// Installed packages are covered by the lockfile and the generator's output by its own inputs, so the walk stops at both.
const importGraph = Effect.fn("Build.importGraph")(function* (project: Project, module: string) {
	const fs = yield* FileSystem.FileSystem;
	const seen = new Map<string, string>();
	const pending = [module];
	for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
		if (!seen.has(file)) {
			const text = yield* fs.readFileString(file);
			seen.set(file, text);
			const imports = yield* resolvedImports(project.config, file, text);
			pending.push(...imports.filter((imported) => !(imported.includes("/node_modules/") || imported.startsWith(project.generated))));
		}
	}
	return seen;
});

export const inputKey = Effect.fn("Build.inputKey")(function* (project: Project, module: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const digest = yield* Digest.Digest;
	const graph = yield* importGraph(project, module);
	const lockfile = yield* lockfileOf(project.root);
	const chain = yield* Effect.forEach([...project.config.chain, ...project.config.declarations], (file) =>
		Effect.map(fs.readFileString(file), (text) => [file, text] as const),
	);
	const lock = Option.isSome(lockfile) ? [[lockfile.value, yield* fs.readFileString(lockfile.value)] as const] : [];
	const entries = [...graph, ...chain, ...lock].map(([file, text]) => `${path.relative(project.root, file)}\u0000${text}`).sort(byText);
	return yield* digest.digestHex(Digest.sha256, new TextEncoder().encode([project.generator, ...entries].join("\u0001")));
});
