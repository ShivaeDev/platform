import { join, posix } from "node:path";
import { Effect, FileSystem, Path, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { requireThat, writeJson } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

export const generatorPath = Effect.flatMap(Path.Path, (path) => path.fromFileUrl(new URL("../../packages/build/src/cli.ts", import.meta.url)));
const GENERATED = "src/generated/";
const PLACEHOLDER = `${GENERATED}README.md`;
// The generator refuses a defineModule call that takes anything but an object literal, so this finds every module file.
const MODULE_CALL = /\bdefineModule\(\s*\{/u;

const checkAgainstSources = Effect.fn("Packed.checkAgainstSources")(function* (pkg: Package, packageRoot: string) {
	const fs = yield* FileSystem.FileSystem;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const generator = yield* generatorPath;
	yield* fs.symlink(join(pkg.directory, "node_modules"), join(packageRoot, "node_modules"));
	yield* writeJson(join(packageRoot, "tsconfig.json"), { extends: join(pkg.directory, "tsconfig.json"), include: ["src"] });
	const child = yield* spawner.spawn(
		ChildProcess.make("node", ["--conditions=@shivaedev/source", generator, "generate", "--check"], { cwd: packageRoot }),
	);
	const [stdout, stderr, code] = yield* Effect.all(
		[child.stdout.pipe(Stream.decodeText, Stream.mkString), child.stderr.pipe(Stream.decodeText, Stream.mkString), child.exitCode],
		{ concurrency: "unbounded" },
	);
	yield* requireThat(
		code === 0,
		`${pkg.manifest.name}: the packed generated files differ from a fresh generate run on the packed sources:\n${stderr.trim() || stdout.trim()}`,
	);
}, Effect.scoped);

// A package that ships defined modules packs src/generated, which Git ignores, so the archive must hold what its sources generate.
export const checkGeneratedOutput = Effect.fn("Packed.checkGeneratedOutput")(function* (pkg: Package, unpacked: string, packed: ReadonlySet<string>) {
	const fs = yield* FileSystem.FileSystem;
	const packageRoot = join(unpacked, "package");
	const generated = [...packed].filter((path) => path.startsWith(GENERATED) && path !== PLACEHOLDER);
	const sources = [...packed].filter((path) => path.startsWith("src/") && !path.startsWith(GENERATED) && path.endsWith(".ts"));
	const modules = yield* Effect.filter(sources, (path) => Effect.map(fs.readFileString(join(packageRoot, path)), (text) => MODULE_CALL.test(text)));
	if (generated.length === 0 && modules.length === 0) {
		return;
	}
	for (const path of generated) {
		const compiled = posix.join("dist", posix.relative("src", path)).replace(/\.ts$/u, ".js");
		yield* requireThat(packed.has(compiled), `${pkg.manifest.name}: packs ${path} without ${compiled}`);
	}
	yield* checkAgainstSources(pkg, packageRoot);
});
