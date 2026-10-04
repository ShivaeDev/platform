import { Effect } from "effect";
import type { Outcome, WorkSpec } from "./domain.ts";
import { checkPublicationScope, inspectCheckout } from "./githubCheckout.ts";
import { githubCommand, githubGit } from "./githubCommand.ts";
import { branchFor, findPublished, listPublished, outcomeFor, type Published } from "./githubPublications.ts";
import { failure } from "./ports.ts";
export function publishGitHub(
	work: WorkSpec,
	revision: string,
	previous?: Extract<
		Outcome,
		{
			kind: "pull-request";
		}
	>,
) {
	return Effect.gen(function* () {
		const branch = yield* branchFor(work);
		const paths = yield* inspectCheckout(work, revision);
		yield* checkPublicationScope(work, paths);
		const existing = yield* listPublished(work);
		const matched = existing.find((pr) => pr.headRefOid === revision && pr.state !== "CLOSED");
		if (matched) {
			return outcomeFor(matched);
		}
		const open = existing.find((pr) => pr.state === "OPEN");
		yield* verifyBranchOwner(work, revision, branch, open, previous);
		const metadata = work.pullRequest;
		if (!metadata || /[\r\n]/u.exec(metadata.title) !== null || !metadata.body.includes("## Why?\n") || !metadata.body.includes("## How?\n")) {
			return yield* Effect.fail(failure("Publication requires approved public title and body with Why? and How? sections", "human"));
		}
		return yield* publishRemote(
			work,
			revision,
			branch,
			existing.some((pr) => pr.state === "OPEN"),
			metadata,
		);
	});
}
function verifyBranchOwner(
	work: WorkSpec,
	revision: string,
	branch: string,
	open: typeof Published.Type | undefined,
	previous:
		| Extract<
				Outcome,
				{
					kind: "pull-request";
				}
		  >
		| undefined,
) {
	return Effect.gen(function* () {
		if (open && (previous?.number !== open.number || previous.revision !== open.headRefOid)) {
			return yield* Effect.fail(failure("An existing PR on this branch is not the durable repair target", "human"));
		}
		const remote = yield* githubGit(work.checkout, ["ls-remote", "--heads", "origin", `refs/heads/${branch}`]);
		const remoteRevision = remote.trim().split("\t")[0];
		if (remoteRevision && remoteRevision !== revision && (!open || remoteRevision !== previous?.revision)) {
			return yield* Effect.fail(failure("Publication branch is already owned by different work", "human"));
		}
	});
}
function publishRemote(work: WorkSpec, revision: string, branch: string, hasOpen: boolean, metadata: NonNullable<WorkSpec["pullRequest"]>) {
	return Effect.gen(function* () {
		yield* githubGit(work.checkout, ["push", "origin", `${revision}:refs/heads/${branch}`]);
		if (!hasOpen) {
			yield* githubCommand([
				"pr",
				"create",
				"--repo",
				`github.com/${work.repository}`,
				"--head",
				branch,
				"--base",
				work.baseBranch,
				"--title",
				metadata.title,
				"--body",
				metadata.body,
			]);
		}
		const result = yield* findPublished(work, revision);
		if (!result) {
			return yield* Effect.fail(failure("Publication acknowledgement is uncertain; observe the remote branch before any new publication"));
		}
		return result;
	}).pipe(Effect.mapError((error) => failure(error.message, "uncertain")));
}
