import { Console, Effect } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import type { Scope } from "#baseline/update.ts";
import { shrinkBaseline } from "#cli/baseline.ts";
import type { SetupFailure } from "#failure.ts";
import { resolveBase } from "#git/base.ts";
import { changesSince } from "#git/history.ts";
import type { RuleServices } from "#rule.ts";

function followedMoves(root: string, against: string | undefined): Effect.Effect<Scope, SetupFailure, ChildProcessSpawner.ChildProcessSpawner> {
	return resolveBase(root, against).pipe(
		Effect.flatMap((base) => changesSince(root, [base.commit])),
		Effect.map((changes): Scope => ({ moves: changes.moves })),
		Effect.catchIf(
			() => against === undefined,
			(failure) => Effect.as(Console.error(`quality: moved files are not followed: ${failure.message}`), { moves: new Map() }),
		),
	);
}

export function pruneBaseline(cwd: string, config: string | undefined, against: string | undefined): Effect.Effect<void, SetupFailure, RuleServices> {
	return shrinkBaseline(cwd, config, (session) => followedMoves(session.config.root, against));
}

export function tightenBaseline(cwd: string, config: string | undefined, staged: boolean): Effect.Effect<void, SetupFailure, RuleServices> {
	return shrinkBaseline(cwd, config, (session) => changesSince(session.config.root, staged ? ["--cached"] : ["HEAD"]));
}
