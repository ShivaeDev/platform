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
	args: readonly string[] | string,
	options: { readonly stdin?: string; readonly holdStdin?: boolean; readonly onError?: (text: string) => void } = {},
): Promise<CliRun> {
	return new Promise((resolve, reject) => {
		const child =
			typeof args === "string"
				? spawn(
						"bash",
						[
							"-c",
							`fleet_test_node=$1\nfleet_test_guard=$2\nfleet_test_cli=$3\nwork-fleet() { exec "$fleet_test_node" --conditions=source --import "$fleet_test_guard" "$fleet_test_cli" "$@"; }\n${args}`,
							"fleet-answer-hint",
							process.execPath,
							DATABASE_GUARD,
							CLI,
						],
						{ stdio: "pipe" },
					)
				: spawn(process.execPath, ["--conditions=source", "--import", DATABASE_GUARD, CLI, ...args], { stdio: "pipe" });
		let stdout = "";
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => options.onError?.(chunk.toString()));
		child.stdin.on("error", reject);
		if (options.holdStdin === true) {
			child.on("close", () => child.stdin.end());
		} else {
			child.stdin.end(options.stdin ?? "");
		}
		child.on("error", reject);
		child.on("close", (code) =>
			code === 97 ? reject(new Error("Fleet client attempted a direct PostgreSQL connection")) : resolve({ code, stdout: stdout.trim() }),
		);
	});
}

export function waitProcess(
	boardDir: string,
	workId: string,
	{ intervalSeconds = 0.1, timeoutSeconds = 20 }: { readonly intervalSeconds?: number; readonly timeoutSeconds?: number } = {},
): Promise<CliRun> {
	return cliProcess(["wait", workId, "--board", boardDir, "--interval", String(intervalSeconds), "--timeout", String(timeoutSeconds)]);
}
