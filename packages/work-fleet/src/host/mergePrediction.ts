import { Clock, Effect, Schema } from "effect";
import type { FleetError } from "#errors.ts";
import { type GithubRead, githubJson } from "#host/github.ts";
import type { MainSource } from "#host/mainSource.ts";
import type { MergePrediction } from "#MergePrediction.ts";

const PredictionPr = Schema.Struct({
	createdAt: Schema.String,
	head: Schema.Struct({ sha: Schema.String }),
	merged: Schema.Boolean,
	number: Schema.Number,
	state: Schema.Literals(["open", "closed"]),
}).pipe(Schema.encodeKeys({ createdAt: "created_at" }));

export function mergePrediction(read: GithubRead, main: typeof MainSource.Service, repository: Effect.Effect<string, FleetError>) {
	return Effect.fn("FleetHost.mergePrediction")(function* (
		prUrl: string,
		watchedPrs: readonly string[],
	): Effect.fn.Return<MergePrediction, FleetError> {
		const repo = yield* repository;
		const prs = yield* Effect.forEach([...new Set([prUrl, ...watchedPrs])], (url) =>
			githubJson(PredictionPr, read.get(`repos/${repo}/pulls/${url.split("/").at(-1)}`)).pipe(Effect.map((pr) => ({ ...pr, url }))),
		);
		const own = prs.find((pr) => pr.url === prUrl);
		const open = prs.filter((pr) => pr.state === "open" && pr.url !== prUrl);
		const snapshot = yield* main.refresh;
		const observedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
		const conflicts: MergePrediction["conflicts"][number][] = [];
		if (own?.state === "open" && main.mergeConflicts !== undefined) {
			const targets = [
				{ head: snapshot.revision, pr: "main", wait: false },
				...open.map((pr) => ({
					head: pr.head.sha,
					pr: pr.url,
					wait: pr.createdAt < own.createdAt || (pr.createdAt === own.createdAt && pr.number < own.number),
				})),
			];
			const predictions = yield* main.mergeConflicts(
				own.head.sha,
				targets.map((target) => target.head),
			);
			for (const [index, target] of targets.entries()) {
				const files = predictions[index] ?? [];
				if (files.length > 0) {
					conflicts.push({ files, head: own.head.sha, observedAt, otherHead: target.head, otherPr: target.pr, wait: target.wait });
				}
			}
		}
		return {
			conflicts,
			head: own?.head.sha ?? "",
			mainRevision: snapshot.revision,
			mergedPrs: prs.filter((pr) => pr.merged).map((pr) => pr.url),
			observedAt,
		};
	});
}
