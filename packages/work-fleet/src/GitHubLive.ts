import { Effect, Layer } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import type { PullRequest, WorkSpec } from "./domain.ts";
import { verifyChange, verifyIntegrated, verifyNoChange } from "./githubCheckout.ts";
import { githubCommand } from "./githubCommand.ts";
import { githubFields, parsePullRequest, validateTarget } from "./githubContract.ts";
import { findPublished } from "./githubPublications.ts";
import { ChangeHost, failure } from "./ports.ts";
import { publishGitHub } from "./publishGitHub.ts";
export interface GitHubOptions {
	readonly mergeMethod?: "merge" | "squash" | "rebase";
}
export function GitHubLive(options: GitHubOptions = {}) {
	return Layer.effect(
		ChangeHost,
		Effect.gen(function* () {
			const services = yield* Effect.context<ChildProcessSpawner>();
			function observe(work: WorkSpec, number: number) {
				return Effect.gen(function* () {
					yield* validateTarget(work, number);
					const output = yield* githubCommand(["pr", "view", String(number), "--repo", `github.com/${work.repository}`, "--json", githubFields]);
					return yield* parsePullRequest(output, work, number);
				}).pipe(Effect.provideContext(services));
			}
			return {
				backendId: "github",
				findPublished: (work, revision) => findPublished(work, revision).pipe(Effect.provideContext(services)),
				merge: (work, number, revision) =>
					Effect.gen(function* () {
						const current = yield* observe(work, number);
						if (current.revision !== revision || current.state !== "open" || current.mergeable !== "ready") {
							return yield* Effect.fail(failure("Pull request head or repository merge requirements changed; reconcile before delivery", "retry"));
						}
						if (!checksPassed(work, current)) {
							return yield* Effect.fail(failure("Configured required checks have not passed on the current head", "retry"));
						}
						yield* verifyChange(work, revision);
						yield* verifyIntegrated(work, revision);
						yield* githubCommand([
							"pr",
							"merge",
							String(number),
							"--repo",
							`github.com/${work.repository}`,
							mergeFlag(options.mergeMethod),
							"--match-head-commit",
							revision,
						]);
					}).pipe(Effect.provideContext(services), Effect.asVoid),
				observe,
				publish: (work, revision, previous) => publishGitHub(work, revision, previous).pipe(Effect.provideContext(services)),
				verifyChange: (work, revision) => verifyChange(work, revision).pipe(Effect.provideContext(services)),
				verifyNoChange: (work, revision) => verifyNoChange(work, revision).pipe(Effect.provideContext(services)),
			};
		}),
	);
}
function mergeFlag(method: GitHubOptions["mergeMethod"]): string {
	if (method === "squash") {
		return "--squash";
	}
	if (method === "rebase") {
		return "--rebase";
	}
	return "--merge";
}
function checksPassed(work: WorkSpec, current: PullRequest): boolean {
	return work.requiredChecks.every((name) => {
		const matches = current.checks.filter((check) => check.name === name);
		return matches.length > 0 && matches.every((check) => check.status === "passed");
	});
}
