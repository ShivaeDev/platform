import { createRequire } from "node:module";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Path, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const PACKAGE = fileURLToPath(new URL("../..", import.meta.url));

// The packages a fixture project imports, linked from this package's own install so they resolve as an application's do.
const LINKED: readonly (readonly [string, string])[] = [
	["effect", createRequire(import.meta.url).resolve("effect/package.json")],
	["@shivaedev/changes", createRequire(import.meta.url).resolve("@shivaedev/changes/package.json")],
	["@shivaedev/contract", createRequire(import.meta.url).resolve("@shivaedev/contract/package.json")],
	["@shivaedev/errors", createRequire(import.meta.url).resolve("@shivaedev/errors/package.json")],
	["@shivaedev/quality", createRequire(import.meta.url).resolve("@shivaedev/quality/package.json")],
];

const MANIFEST = { imports: { "#*": "./src/*" }, name: "fixture-app", private: true, type: "module" };

const TSCONFIG = {
	compilerOptions: { customConditions: ["@shivaedev/source"], types: [] },
	extends: "@shivaedev/quality/tsconfig/base.json",
	include: ["src"],
};

export const emptyProject = Effect.fn("BuildStory.emptyProject")(function* () {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "build-story-" }));
	yield* fs.writeFileString(path.join(root, "package.json"), `${JSON.stringify(MANIFEST, undefined, "\t")}\n`);
	yield* fs.writeFileString(path.join(root, "tsconfig.json"), `${JSON.stringify(TSCONFIG, undefined, "\t")}\n`);
	for (const [name, manifest] of LINKED) {
		yield* fs.makeDirectory(path.dirname(path.join(root, "node_modules", name)), { recursive: true });
		yield* fs.symlink(path.dirname(manifest), path.join(root, "node_modules", name));
	}
	return root;
});

export const writeFiles = Effect.fn("BuildStory.writeFiles")(function* (root: string, files: Readonly<Record<string, string>>) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	for (const [file, text] of Object.entries(files)) {
		yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
		yield* fs.writeFileString(path.join(root, file), text);
	}
});

const runIn = Effect.fn("BuildStory.runIn")(function* (root: string, lock: string, executable: string, args: readonly string[]) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const child = yield* spawner.spawn(ChildProcess.make(executable, args, { cwd: root, env: { "HEAVY_PROCESS_LOCK": lock }, extendEnv: true }));
	const [stdout, stderr, code] = yield* Effect.all(
		[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
		{ concurrency: "unbounded" },
	);
	return { code: Number(code), stderr: stderr.trim(), stdout: stdout.trim() };
}, Effect.scoped);

export const typeCheck = Effect.fn("BuildStory.typeCheck")(function* (root: string, lock: string) {
	const { code, stderr, stdout } = yield* runIn(root, lock, `${PACKAGE}node_modules/.bin/tsc`, [
		"--noEmit",
		"--pretty",
		"false",
		"-p",
		"tsconfig.json",
	]);
	const output = `${stdout}${stderr}`.trim();
	return code === 0 && output === "" ? "compiles cleanly" : output;
});

// The command line run from source, as a workspace package calls it before any build.
export const fromSource = Effect.fn("BuildStory.fromSource")(function* (root: string, lock: string, args: readonly string[]) {
	const { code, stderr, stdout } = yield* runIn(root, lock, process.execPath, ["--conditions=@shivaedev/source", `${PACKAGE}src/cli.ts`, ...args]);
	return { code, printed: stdout.split("\n"), problems: stderr.split("\n") };
});
