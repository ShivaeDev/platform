import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));

export interface CliRun {
	readonly code: number | null;
	readonly stdout: string;
}

export function cliProcess(args: readonly string[]): Promise<CliRun> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["--conditions=source", CLI, ...args], { stdio: ["ignore", "pipe", "ignore"] });
		let stdout = "";
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ code, stdout: stdout.trim() }));
	});
}
