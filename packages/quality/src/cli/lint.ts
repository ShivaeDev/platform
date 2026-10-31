import { relative } from "node:path";
import { Console, Effect } from "effect";
import { looseStagedEntries } from "#baseline/looseStagedEntries.ts";
import { evaluate, passes } from "#engine/evaluate.ts";
import { openSession } from "#engine/session.ts";
import { keyOf } from "#engine/violation.ts";
import { GateFailed, type SetupFailure } from "#failure.ts";
import { render } from "#report/render.ts";
import type { RuleServices } from "#rule.ts";

export const lint = Effect.fn("Cli.lint")(function* (
	cwd: string,
	config: string | undefined,
	staged = false,
): Effect.fn.Return<void, SetupFailure | GateFailed, RuleServices> {
	const session = yield* openSession(cwd, config);
	const evaluated = evaluate(session.violations, session.registry, session.baseline.entries, session.config);
	const loose = staged ? yield* looseStagedEntries(session) : [];
	const rejected = new Set(loose.map(({ entry }) => keyOf(entry.rule, entry.file)));
	const outcome = {
		...evaluated,
		looseBaseline: evaluated.looseBaseline.filter(({ entry }) => !rejected.has(keyOf(entry.rule, entry.file))),
		staleBaseline: [...evaluated.staleBaseline, ...loose],
	};
	yield* Console.log(
		render(outcome, {
			baseline: session.config.baseline,
			checked: session.inventory.sources.length,
			descriptions: new Map(session.config.active.map((rule) => [rule.id, rule.description])),
			registry: session.config.exceptions.length === 0 ? session.config.registry : `${relative(session.config.root, session.config.file)} exceptions`,
		}),
	);
	if (!passes(outcome)) {
		return yield* new GateFailed();
	}
});
