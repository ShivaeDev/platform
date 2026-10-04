import { Console, Effect, type FileSystem } from "effect";
import { evaluate, passes } from "#engine/evaluate.ts";
import { openSession } from "#engine/session.ts";
import { GateFailed, type SetupFailure } from "#failure.ts";
import { render, type WarningDetail } from "#report/render.ts";

export const lint = (
	cwd: string,
	config: string | undefined,
	warnings: WarningDetail,
): Effect.Effect<void, SetupFailure | GateFailed, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const session = yield* openSession(cwd, config);
		const outcome = evaluate(session.violations, session.registry, session.baseline.entries, session.config);
		yield* Console.log(
			render(outcome, {
				baseline: session.config.baseline,
				checked: session.inventory.sources.length,
				descriptions: new Map(session.config.active.map((rule) => [rule.id, rule.description])),
				registry: session.config.registry,
				warnings,
			}),
		);
		if (!passes(outcome)) {
			return yield* new GateFailed();
		}
	});
