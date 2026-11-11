import { createRequire } from "node:module";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Path, type PlatformError, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const PACKAGE = fileURLToPath(new URL("../..", import.meta.url));

// The packages a fixture project imports, linked from this package's own install so they resolve as an application's do.
const LINKED: readonly (readonly [string, string])[] = [
	["effect", createRequire(import.meta.url).resolve("effect/package.json")],
	["@shivaedev/changes", createRequire(import.meta.url).resolve("@shivaedev/changes/package.json")],
	["@shivaedev/contract", createRequire(import.meta.url).resolve("@shivaedev/contract/package.json")],
	["@shivaedev/errors", createRequire(import.meta.url).resolve("@shivaedev/errors/package.json")],
	["@shivaedev/quality", createRequire(import.meta.url).resolve("@shivaedev/quality/package.json")],
	["vitest", createRequire(import.meta.url).resolve("vitest/package.json")],
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

const filesUnder = Effect.fn("BuildStory.filesUnder")(function* (
	root: string,
	directory: string,
): Effect.fn.Return<readonly (readonly [string, string])[], PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const full = path.join(root, directory);
	if (!(yield* fs.exists(full))) {
		return [];
	}
	const entries = (yield* fs.readDirectory(full)).filter((entry) => entry !== "node_modules").sort();
	const found = yield* Effect.forEach(entries, (entry) =>
		Effect.flatMap(fs.stat(path.join(full, entry)), (info) =>
			info.type === "Directory"
				? filesUnder(root, path.join(directory, entry))
				: Effect.map(fs.readFileString(path.join(full, entry)), (text) => [[path.join(directory, entry), text] as const]),
		),
	);
	return found.flat();
});

const generatedFor = new Map<string, Readonly<Record<string, string>>>();

// What generate writes depends only on the project's files, not on its folder, and Vitest loads this module once per spec file:
// the first story of a file that needs a project generated pays for the program, and later stories copy what it wrote.
export const generatedOncePerFile = Effect.fn("BuildStory.generatedOncePerFile")(function* <E, R>(
	root: string,
	generate: Effect.Effect<unknown, E, R>,
) {
	const key = JSON.stringify(yield* filesUnder(root, ""));
	const known = generatedFor.get(key);
	if (known !== undefined) {
		return yield* writeFiles(root, known);
	}
	yield* generate;
	const written = [...(yield* filesUnder(root, "src/generated")), ...(yield* filesUnder(root, "node_modules/.cache/@shivaedev/build"))];
	generatedFor.set(key, Object.fromEntries(written));
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

export const fromSource = Effect.fn("BuildStory.fromSource")(function* (root: string, lock: string, args: readonly string[]) {
	const { code, stderr, stdout } = yield* runIn(root, lock, process.execPath, ["--conditions=@shivaedev/source", `${PACKAGE}src/cli.ts`, ...args]);
	return { code, printed: stdout.split("\n"), problems: stderr.split("\n") };
});

interface VitestReport {
	readonly testResults?: readonly { readonly assertionResults: readonly { readonly status: string; readonly title: string }[] }[];
}

export const vitestRun = Effect.fn("BuildStory.vitestRun")(function* (root: string, lock: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const vitest = path.join(path.dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");
	const output = path.join(yield* fs.makeTempDirectoryScoped({ prefix: "vitest-report-" }), "report.json");
	const { code, stderr, stdout } = yield* runIn(root, lock, process.execPath, [
		"--conditions=@shivaedev/source",
		vitest,
		"run",
		"--reporter=json",
		`--outputFile=${output}`,
	]);
	const report: VitestReport = (yield* fs.exists(output)) ? JSON.parse(yield* fs.readFileString(output)) : {};
	const ran = Object.fromEntries(
		(report.testResults ?? []).flatMap(({ assertionResults }) => assertionResults.map(({ status, title }) => [title, status])),
	);
	return code === 0 ? { ran } : { failed: `${stdout}\n${stderr}`.trim(), ran };
});
