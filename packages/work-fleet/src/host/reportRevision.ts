import { Effect } from "effect";
import { gitProcess } from "#host/adapters/gitProcess.ts";
import { predictionGit } from "#host/gitMergeTree.ts";

export function reportRevision(cwd: string, remote: string) {
	return Effect.fn("FleetHost.reportRevision")(function* (base: string, revision: string) {
		yield* predictionGit(cwd, ["fetch", "--quiet", remote, base, revision]);
		const result = yield* gitProcess(cwd, ["merge-base", "--is-ancestor", base, revision], {
			acceptExitOne: true,
			failureMessage: (message) => `Report revision ancestry could not be checked: ${message}`,
		});
		return result.exitCode === 0;
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
