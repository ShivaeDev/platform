import { Effect, Schema } from "effect";
import type { Outcome, WorkSpec } from "./domain.ts";
import { githubCommand } from "./githubCommand.ts";
import { validateTarget } from "./githubContract.ts";
import { failure } from "./ports.ts";
export const Published = Schema.Struct({
	baseRefName: Schema.String,
	headRefName: Schema.String,
	headRefOid: Schema.String.check(Schema.isPattern(/^[a-f0-9]{40}$/iu)),
	isCrossRepository: Schema.Boolean,
	number: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
	state: Schema.Literals(["OPEN", "CLOSED", "MERGED"]),
	url: Schema.String,
});
export function branchFor(work: WorkSpec) {
	return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.exec(work.id) === null
		? Effect.fail(failure("Publication requires a work id of 1-64 letters, numbers, underscores or hyphens", "human"))
		: Effect.succeed(`work-fleet/${work.id}`);
}
export function listPublished(work: WorkSpec) {
	return Effect.gen(function* () {
		yield* validateTarget(work, 1);
		const branch = yield* branchFor(work);
		const text = yield* githubCommand([
			"pr",
			"list",
			"--repo",
			`github.com/${work.repository}`,
			"--head",
			branch,
			"--base",
			work.baseBranch,
			"--state",
			"all",
			"--limit",
			"100",
			"--json",
			Object.keys(Published.fields).join(","),
		]);
		const responses = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Array(Published)))(text).pipe(
			Effect.mapError(() => failure("GitHub returned an invalid publication response", "retry")),
		);
		return responses.filter(
			(pr) =>
				!pr.isCrossRepository
				&& pr.headRefName === branch
				&& pr.baseRefName === work.baseBranch
				&& pr.url.toLowerCase() === `https://github.com/${work.repository}/pull/${pr.number}`.toLowerCase(),
		);
	});
}
export function outcomeFor(pr: typeof Published.Type): Extract<
	Outcome,
	{
		kind: "pull-request";
	}
> {
	return {
		kind: "pull-request",
		number: pr.number,
		revision: pr.headRefOid,
		url: pr.url,
	};
}
export function findPublished(work: WorkSpec, revision: string) {
	return Effect.gen(function* () {
		const responses = yield* listPublished(work);
		const match = responses.find((pr) => pr.headRefOid === revision && pr.state !== "CLOSED");
		return match ? outcomeFor(match) : null;
	});
}
