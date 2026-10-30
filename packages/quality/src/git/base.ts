import { Effect } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { SetupFailure } from "#failure.ts";
import { run } from "./command.ts";

export interface Base {
	readonly commit: string;
	readonly ref: string;
}

const FALLBACK_BRANCHES = ["origin/main", "origin/master"];

function fail(message: string) {
	return Effect.fail(new SetupFailure({ message }));
}

function isCommit(root: string, ref: string): Effect.Effect<boolean, SetupFailure, ChildProcessSpawner.ChildProcessSpawner> {
	return Effect.map(run(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]), (result) => result.code === 0);
}

const defaultBranch = Effect.fn("Git.defaultBranch")(function* (
	root: string,
): Effect.fn.Return<string, SetupFailure, ChildProcessSpawner.ChildProcessSpawner> {
	const head = yield* run(root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
	if (head.code === 0) {
		return head.stdout.trim();
	}
	for (const candidate of FALLBACK_BRANCHES) {
		if (yield* isCommit(root, candidate)) {
			return candidate;
		}
	}
	return yield* fail(
		"cannot find the default branch: origin/HEAD, origin/main and origin/master are missing. Pass --against <ref>, or run `git remote set-head origin --auto`.",
	);
});

function isShallow(root: string): Effect.Effect<boolean, SetupFailure, ChildProcessSpawner.ChildProcessSpawner> {
	return Effect.map(run(root, ["rev-parse", "--is-shallow-repository"]), (result) => result.stdout.trim() === "true");
}

function mergeBase(root: string, ref: string): Effect.Effect<string | undefined, SetupFailure, ChildProcessSpawner.ChildProcessSpawner> {
	return Effect.map(run(root, ["merge-base", "HEAD", ref]), (result) => (result.code === 0 ? result.stdout.trim() : undefined));
}

function missingMergeBase(root: string, ref: string): Effect.Effect<never, SetupFailure, ChildProcessSpawner.ChildProcessSpawner> {
	return Effect.flatMap(isShallow(root), (shallow) =>
		fail(
			shallow
				? `the clone is shallow and does not reach the merge base of HEAD and ${ref}. Fetch the history first: \`git fetch --unshallow\`.`
				: `HEAD and ${ref} share no history.`,
		),
	);
}

function reachMergeBase(root: string, ref: string): Effect.Effect<string, SetupFailure, ChildProcessSpawner.ChildProcessSpawner> {
	return Effect.flatMap(mergeBase(root, ref), (found) => (found === undefined ? missingMergeBase(root, ref) : Effect.succeed(found)));
}

export const resolveBase = Effect.fn("Git.resolveBase")(function* (
	root: string,
	against: string | undefined,
): Effect.fn.Return<Base, SetupFailure, ChildProcessSpawner.ChildProcessSpawner> {
	const inside = yield* run(root, ["rev-parse", "--is-inside-work-tree"]);
	if (inside.code !== 0 || inside.stdout.trim() !== "true") {
		return yield* fail(`${root} is not in a git work tree; moves are followed through git history.`);
	}
	const ref = against ?? (yield* defaultBranch(root));
	if (!(yield* isCommit(root, ref))) {
		return yield* fail(`${ref} names no commit in this clone. Fetch it first, or pass another --against <ref>.`);
	}
	return { commit: yield* reachMergeBase(root, ref), ref };
});
