import { Effect } from "effect";
import { SetupFailure } from "../failure.ts";
import { type Git, git } from "./command.ts";

export interface Base {
	readonly ref: string;
	readonly commit: string;
}

const FALLBACK_BRANCHES = ["origin/main", "origin/master"];

const fail = (message: string) => Effect.fail(new SetupFailure({ message }));

const isCommit = (root: string, ref: string): Effect.Effect<boolean, SetupFailure, Git> =>
	Effect.map(git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]), (result) => result.code === 0);

const defaultBranch = (root: string): Effect.Effect<string, SetupFailure, Git> =>
	Effect.gen(function* () {
		const head = yield* git(root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
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

const missingMergeBase = (root: string, ref: string): Effect.Effect<never, SetupFailure, Git> =>
	Effect.flatMap(git(root, ["rev-parse", "--is-shallow-repository"]), (shallow) =>
		fail(
			shallow.stdout.trim() === "true"
				? `the clone is shallow and does not reach the merge base of HEAD and ${ref}. Fetch the history first: \`git fetch --unshallow\`, or fetch-depth: 0 in actions/checkout.`
				: `HEAD and ${ref} share no history.`,
		),
	);

export const resolveBase = (root: string, against: string | undefined): Effect.Effect<Base, SetupFailure, Git> =>
	Effect.gen(function* () {
		const inside = yield* git(root, ["rev-parse", "--is-inside-work-tree"]);
		if (inside.code !== 0 || inside.stdout.trim() !== "true") {
			return yield* fail(`${root} is not in a git work tree; the baseline is compared with its version in git history.`);
		}
		const ref = against ?? (yield* defaultBranch(root));
		if (!(yield* isCommit(root, ref))) {
			return yield* fail(`${ref} names no commit in this clone. Fetch it first, or pass another --against <ref>.`);
		}
		const merged = yield* git(root, ["merge-base", "HEAD", ref]);
		return merged.code === 0 ? { commit: merged.stdout.trim(), ref } : yield* missingMergeBase(root, ref);
	});
