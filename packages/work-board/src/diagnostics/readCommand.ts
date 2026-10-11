import { execFile } from "node:child_process";
import { Effect } from "effect";
import { SourceFailure } from "./source.ts";

export function readCommand(command: string, args: readonly string[]) {
	return Effect.callback<string, SourceFailure>((resume) => {
		const child = execFile(command, args, { maxBuffer: 1024 * 1024, timeout: 30_000 }, (error, stdout, stderr) => {
			if (error === null) {
				resume(Effect.succeed(stdout));
				return;
			}
			const missing = error.code === "ENOENT" || stderr.includes("gh auth login") || stderr.includes("GH_TOKEN environment variable");
			resume(
				Effect.fail(
					new SourceFailure({
						kind: missing ? "not-configured" : "error",
						message: missing ? `${command} is not installed or authenticated` : (stderr.trim() || error.message).slice(0, 500),
					}),
				),
			);
		});
		return Effect.sync(() => child.kill());
	});
}
