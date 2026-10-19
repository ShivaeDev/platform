import { execFile } from "node:child_process";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { FleetError } from "#errors.ts";

export function predictionGit(cwd: string, args: readonly string[], conflicts = false) {
	return Effect.callback<string, FleetError>((resume) => {
		execFile("git", [...args], { cwd, maxBuffer: 10 * 1024 * 1024, timeout: 60_000 }, (error, stdout) => {
			resume(
				error === null || (conflicts && error.code === 1)
					? Effect.succeed(stdout)
					: Effect.fail(new ServiceUnavailable({ message: `git ${args[0]} failed: ${error.message}` })),
			);
		});
	});
}

export function mergeTreeConflicts(cwd: string, head: string, otherHead: string) {
	return predictionGit(cwd, ["merge-tree", "--write-tree", "--name-only", "-z", head, otherHead], true).pipe(
		Effect.map((output) => {
			const fields = output.split("\0").slice(1);
			const end = fields.indexOf("");
			return fields.slice(0, end < 0 ? fields.length : end);
		}),
	);
}
