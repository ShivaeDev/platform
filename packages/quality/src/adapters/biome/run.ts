import { createRequire } from "node:module";
import process from "node:process";
import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { withExceptionConfig } from "#biome/exceptionConfig.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { shadcnFolders } from "#inventory/shadcnFolders.ts";

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
) {
	const folders = yield* shadcnFolders(root);
	const toolOwned: readonly ExceptionDeclaration[] = [
		{
			files: ["**", "!**/pnpm-lock.yaml", ...folders.map((folder) => `!${folder}`)],
			reason: "pnpm writes its lockfiles; components.json assigns UI folders to the shadcn CLI.",
			rules: ["biome/files/includes"],
		},
	];
	return yield* Effect.scoped(
		withExceptionConfig(root, [...exceptions, ...toolOwned], (configArgs) =>
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
		),
	);
});
