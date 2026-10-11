import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface CliRun {
	readonly code: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

export function cliProcess(args: readonly string[], stdin = ""): Promise<CliRun> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["--conditions=source", fileURLToPath(new URL("../cli.ts", import.meta.url)), ...args], { stdio: "pipe" });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.stdin.on("error", reject);
		child.stdin.end(stdin);
		child.on("error", reject);
		child.on("close", (code) => resolve({ code, stderr: stderr.trim(), stdout: stdout.trim() }));
	});
}
