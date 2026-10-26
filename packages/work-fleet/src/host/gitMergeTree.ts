import { execFile } from "node:child_process";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/effect-contract/errors/taxonomy.ts";
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

function predictionChangedPaths(cwd: string, main: string, head: string) {
	return predictionGit(cwd, ["diff", "--name-only", "-z", `${main}...${head}`, "--"]).pipe(
		Effect.map((output) => new Set(output.split("\0").filter((path) => path.length > 0))),
	);
}

export const predictedMergeConflicts = Effect.fn("FleetHost.predictedMergeConflicts")(function* (
	cwd: string,
	main: string,
	head: string,
	otherHeads: readonly string[],
) {
	const ownPaths = yield* predictionChangedPaths(cwd, main, head);
	return yield* Effect.forEach(otherHeads, (other) =>
		Effect.gen(function* () {
			const files = yield* mergeTreeConflicts(cwd, head, other);
			if (other === main || files.length === 0) {
				return files;
			}
			const otherPaths = yield* predictionChangedPaths(cwd, main, other);
			return files.filter((path) => ownPaths.has(path) && otherPaths.has(path));
		}),
	);
});
