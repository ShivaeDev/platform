import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

export interface BiomeRun {
	readonly code: number;
	readonly stderr: string;
	readonly stdout: string;
}

const BIN = createRequire(import.meta.url).resolve("@biomejs/biome/bin/biome");

export function runBiome(root: string, args: ReadonlyArray<string>): Promise<BiomeRun> {
	return new Promise((resolve, reject) => {
		execFile(process.execPath, [BIN, ...args, "--colors=off"], { cwd: root, maxBuffer: 2 ** 30 }, (error, stdout, stderr) => {
			if (error !== null && typeof error.code !== "number") {
				reject(error);
				return;
			}
			resolve({ code: error === null ? 0 : Number(error.code), stderr, stdout });
		});
	});
}
