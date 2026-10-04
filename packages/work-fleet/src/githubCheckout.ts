import { Effect } from "effect";
import type { WorkSpec } from "./domain.ts";
import { githubGit } from "./githubCommand.ts";
import { validateTarget } from "./githubContract.ts";
import { githubRevisionChecks } from "./githubRevisionChecks.ts";
import { failure } from "./ports.ts";
import { verifyCheckoutConfig } from "./verifyCheckoutConfig.ts";

function matchesOrigin(remote: string, repository: string) {
	const target = remote
		.trim()
		.replace(/\.git$/u, "")
		.toLowerCase();
	return target === `https://github.com/${repository.toLowerCase()}` || target === `git@github.com:${repository.toLowerCase()}`;
}
export function inspectCheckout(work: WorkSpec, revision: string) {
	return Effect.gen(function* () {
		yield* validateTarget(work, 1);
		yield* verifyCheckoutConfig(work);
		if (/^[a-f0-9]{40}$/iu.exec(revision) === null) {
			return yield* Effect.fail(failure("Expected a full Git commit revision", "human"));
		}
		function git(args: ReadonlyArray<string>) {
			return githubGit(work.checkout, args);
		}
		yield* git(["check-ref-format", `refs/heads/${work.baseBranch}`]);
		const head = yield* git(["rev-parse", "--verify", "HEAD"]);
		const status = yield* git(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=all"]);
		if (head.trim() !== revision || status.length > 0) {
			return yield* Effect.fail(failure("Checkout must be clean at the declared worker revision", "repair"));
		}
		const fetchOrigin = yield* git(["remote", "get-url", "origin"]);
		const pushOrigin = yield* git(["remote", "get-url", "--push", "origin"]);
		if (!(matchesOrigin(fetchOrigin, work.repository) && matchesOrigin(pushOrigin, work.repository))) {
			return yield* Effect.fail(failure("Checkout origin does not match the approved GitHub repository", "human"));
		}
		yield* git(["fetch", "--no-tags", "origin", `refs/heads/${work.baseBranch}:refs/remotes/origin/${work.baseBranch}`]);
		const paths = yield* git([
			"diff",
			"--no-ext-diff",
			"--no-textconv",
			"--no-renames",
			"--name-only",
			"-z",
			`origin/${work.baseBranch}...${revision}`,
			"--",
		]);
		return paths.split("\0").filter((path) => path.length > 0);
	});
}
export function checkPublicationScope(work: WorkSpec, paths: ReadonlyArray<string>) {
	return Effect.gen(function* () {
		if (paths.length === 0) {
			return yield* Effect.fail(failure("Publication requires a changed outcome; report no-change instead", "repair"));
		}
		for (const path of paths) {
			const allowed = work.scope.some((scope) => {
				const prefix = scope.path.replace(/\/$/u, "");
				return scope.key === null && (prefix === "." || path === prefix || path.startsWith(`${prefix}/`));
			});
			if (!allowed) {
				return yield* Effect.fail(failure("Committed changes exceed whole-path authority; structured-key publication is not supported", "human"));
			}
		}
	});
}
export function verifyNoChange(work: WorkSpec, revision: string) {
	return Effect.gen(function* () {
		const paths = yield* inspectCheckout(work, revision);
		if (paths.length > 0) {
			return yield* Effect.fail(failure("The declared no-change revision contains changes relative to the current base", "repair"));
		}
		const base = yield* githubGit(work.checkout, ["rev-parse", "--verify", `refs/remotes/origin/${work.baseBranch}`]);
		if (base.trim() !== revision) {
			return yield* Effect.fail(failure("No-change must be reviewed at the current fetched base revision", "repair"));
		}
		yield* githubRevisionChecks(work, revision);
	});
}
export function verifyChange(work: WorkSpec, revision: string) {
	return Effect.flatMap(inspectCheckout(work, revision), (paths) => checkPublicationScope(work, paths));
}
export function verifyIntegrated(work: WorkSpec, revision: string) {
	return githubGit(work.checkout, ["merge-base", "--is-ancestor", `refs/remotes/origin/${work.baseBranch}`, revision]).pipe(
		Effect.asVoid,
		Effect.mapError(() => failure("Integrate the current base into the reviewed commit before delivery", "repair")),
	);
}
