import { execFile } from "node:child_process";
import { Effect } from "effect";

interface CommandResult {
	readonly status: number;
	readonly stderr: string;
	readonly stdout: string;
}

export function command(root: string, args: readonly string[]) {
	return Effect.tryPromise({
		catch: (cause) => new Error(`Cannot run pnpm ${args.join(" ")}`, { cause }),
		try: (signal) =>
			new Promise<CommandResult>((resolve) => {
				execFile(
					"env",
					["CHANGELOG_BASE_REF=main", "pnpm", ...args],
					{ cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, signal },
					(error, stdout, stderr) => {
						let status = 0;
						if (error !== null) {
							status = typeof error.code === "number" ? error.code : 1;
						}
						resolve({
							status,
							stderr: error === null ? stderr : `${stderr}\n${error.message}`,
							stdout,
						});
					},
				);
			}),
	});
}
