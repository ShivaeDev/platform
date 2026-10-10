import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export function runDisconnectedBegin(): Promise<{ readonly status: number | null; readonly stderr: string; readonly stdout: string }> {
	const child = spawn(process.execPath, ["--conditions=source", fileURLToPath(import.meta.resolve("#test/disconnectedBeginProcess.ts"))]);
	let stdout = "";
	let stderr = "";
	child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
		stdout += chunk;
	});
	child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
		stderr += chunk;
	});
	return new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("close", (status) => resolve({ status, stderr, stdout }));
	});
}
