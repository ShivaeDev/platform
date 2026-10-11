import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function fleetCli(configFile: string, args: readonly string[]) {
	return new Promise<{ readonly code: number | null; readonly stderr: string; readonly stdout: string }>((resolve, reject) => {
		const child = spawn(
			process.execPath,
			["--conditions=source", fileURLToPath(new URL("../cli.ts", import.meta.url)), ...args, "--board", dirname(configFile), "--config", configFile],
			{ stdio: ["ignore", "pipe", "pipe"] },
		);
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ code, stderr: stderr.trim(), stdout: stdout.trim() }));
	});
}
