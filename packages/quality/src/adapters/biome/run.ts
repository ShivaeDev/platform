import { createRequire } from "node:module";
import { relative } from "node:path";
import process from "node:process";
import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { withExceptionConfig } from "#biome/withExceptionConfig.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { posix } from "#inventory/ignoreScope.ts";
import { skillCopies } from "#inventory/skillCopies.ts";
import { toolOwnedFiles } from "#inventory/toolOwnedFiles.ts";

export interface BiomeRun {
	readonly code: number;
	readonly stderr: string;
	readonly stdout: string;
}

const BIN = createRequire(import.meta.url).resolve("@biomejs/biome/bin/biome");

export const runBiome = Effect.fn("Biome.runBiome")(function* (
	root: string,
	args: readonly string[],
	exceptions: readonly ExceptionDeclaration[] = [],
	nonEffectFolders: readonly string[] = [],
) {
	const files = yield* toolOwnedFiles(root);
	const copies = (yield* skillCopies(root)).paths.map((file) => posix(relative(root, file)));
	const toolOwned: readonly ExceptionDeclaration[] = [
		{
			files: ["**", "!**/pnpm-lock.yaml", ...[...files, ...copies].map((file) => `!${file}`)],
			reason: "pnpm, shadcn and the skills tool own their generated files and copies.",
			rules: ["biome/files/includes"],
		},
	];
	return yield* Effect.scoped(
		withExceptionConfig(
			root,
			[...exceptions, ...toolOwned],
			(configArgs) =>
				Effect.gen(function* () {
					const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
					const child = yield* spawner.spawn(
						ChildProcess.make(process.execPath, [BIN, ...args, ...configArgs, "--colors=off"], { cwd: root, stdin: "ignore" }),
					);
					const [stdout, stderr, code] = yield* Effect.all(
						[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
						{ concurrency: "unbounded" },
					);
					return { code: Number(code), stderr, stdout };
				}),
			nonEffectFolders,
		),
	);
});
