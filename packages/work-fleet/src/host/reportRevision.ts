import { execFile } from "node:child_process";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";
import type { FleetError } from "#errors.ts";
import { predictionGit } from "#host/gitMergeTree.ts";

export function reportRevision(cwd: string, remote: string) {
	return Effect.fn("FleetHost.reportRevision")(function* (base: string, revision: string) {
		yield* predictionGit(cwd, ["fetch", "--quiet", remote, base, revision]);
		return yield* Effect.callback<boolean, FleetError>((resume) => {
			execFile("git", ["merge-base", "--is-ancestor", base, revision], { cwd, timeout: 60_000 }, (error) => {
				resume(
					error === null || error.code === 1
						? Effect.succeed(error === null)
						: Effect.fail(new ServiceUnavailable({ message: `Report revision ancestry could not be checked: ${error.message}` })),
				);
			});
		});
	});
}

export function reportedRevision(output: string) {
	const lines = output
		.trim()
		.split(/\r?\n/u)
		.map((line) => line.trim());
	const heads = lines.filter((line) => line.startsWith("FLEET_HEAD:"));
	return heads.length === 1 && heads[0] === lines.at(-1)
		? /^FLEET_HEAD:\s*(?<revision>[a-f\d]{40})$/u.exec(heads[0] ?? "")?.groups?.revision
		: undefined;
}
