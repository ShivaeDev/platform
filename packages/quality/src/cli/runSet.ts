import { Config, Effect } from "effect";
import type { RunSet } from "#engine/session.ts";
import { SetupFailure } from "#failure.ts";

const everyRule = Config.all({
	ci: Config.String("CI").pipe(Config.withDefault("")),
	remote: Config.String("CLAUDE_CODE_REMOTE").pipe(Config.withDefault("")),
}).pipe(Config.map(({ ci, remote }) => ci !== "" || remote === "true"));

// CI and Claude Code cloud sessions run every rule, so a consumer's CI job and cloud commit hook keep the deep rules without changing a script.
export const runSet = Effect.fn("Cli.runSet")(function* (requested: RunSet | undefined) {
	if (requested !== undefined) {
		return requested;
	}
	const full = yield* everyRule.pipe(Effect.mapError((cause) => new SetupFailure({ cause, message: "cannot read CI or CLAUDE_CODE_REMOTE." })));
	return full ? "full" : "fast";
});
