import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DATABASE_GUARD = fileURLToPath(new URL("./clientDatabaseGuard.ts", import.meta.url));
const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));

export interface CliRun {
	readonly code: number | null;
	readonly stdout: string;
}

export function cliProcess(
	args: readonly string[],
	options: { readonly stdin?: string; readonly onError?: (text: string) => void } = {},
): Promise<CliRun> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["--conditions=source", "--import", DATABASE_GUARD, CLI, ...args], { stdio: "pipe" });
		let stdout = "";
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => options.onError?.(chunk.toString()));
		child.stdin.on("error", reject);
		child.stdin.end(options.stdin ?? "");
		child.on("error", reject);
		child.on("close", (code) =>
			code === 97 ? reject(new Error("Fleet client attempted a direct PostgreSQL connection")) : resolve({ code, stdout: stdout.trim() }),
		);
	});
}
