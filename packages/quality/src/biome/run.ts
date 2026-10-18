import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { shadcnFolders } from "#inventory/shadcnFolders.ts";
import { withExceptionConfig } from "./exceptionConfig.ts";

export interface BiomeRun {
	readonly code: number;
	readonly stderr: string;
	readonly stdout: string;
}

const BIN = createRequire(import.meta.url).resolve("@biomejs/biome/bin/biome");

export async function runBiome(root: string, args: readonly string[], exceptions: readonly ExceptionDeclaration[] = []): Promise<BiomeRun> {
	const folders = await Effect.runPromise(shadcnFolders(root).pipe(Effect.provide(NodeFileSystem.layer)));
	const toolOwned: readonly ExceptionDeclaration[] =
		folders.length === 0
			? []
			: [
					{
						files: ["**", ...folders.map((folder) => `!${folder}`)],
						reason: "components.json assigns these folders to the shadcn CLI.",
						rules: ["biome/files/includes"],
					},
				];
	return withExceptionConfig(
		root,
		[...exceptions, ...toolOwned],
		(configArgs) =>
			new Promise((resolve, reject) => {
				execFile(process.execPath, [BIN, ...args, ...configArgs, "--colors=off"], { cwd: root, maxBuffer: 2 ** 30 }, (error, stdout, stderr) => {
					if (error !== null && typeof error.code !== "number") {
						reject(error);
						return;
					}
					resolve({ code: error === null ? 0 : Number(error.code), stderr, stdout });
				});
			}),
	);
}
