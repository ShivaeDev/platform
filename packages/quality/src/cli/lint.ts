import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { Console, Effect, Path } from "effect";
import { withHeavyLock } from "@shivaedev/heavy-lock/withHeavyLock.ts";
import { looseStagedEntries } from "#baseline/looseStagedEntries.ts";
import { runSet } from "#cli/runSet.ts";
import { evaluate, type Outcome, passes } from "#engine/evaluate.ts";
import { openSession, type RunSet } from "#engine/session.ts";
import { keyOf } from "#engine/violation.ts";
import { GateFailed, SetupFailure } from "#failure.ts";
import { type ReportContext, render } from "#report/render.ts";
import { runSetLine } from "#report/runSetLine.ts";
import type { RuleServices } from "#rule.ts";

export interface LintResult {
	readonly context: ReportContext;
	readonly outcome: Outcome;
}

export const reportLint = Effect.fn("Cli.reportLint")(
	function* (cwd: string, config: string | undefined, staged: boolean, requested?: RunSet): Effect.fn.Return<LintResult, SetupFailure, RuleServices> {
		const { relative } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

		const set = yield* runSet(requested);
		const session = yield* openSession(cwd, config, set);
		const evaluated = evaluate(session.violations, session.registry, session.baseline.entries, session.config);
		const loose = staged ? yield* looseStagedEntries(session) : [];
		const rejected = new Set(loose.map(({ entry }) => keyOf(entry.rule, entry.file)));
		const outcome = {
			...evaluated,
			looseBaseline: evaluated.looseBaseline.filter(({ entry }) => !rejected.has(keyOf(entry.rule, entry.file))),
			staleBaseline: [...evaluated.staleBaseline, ...loose],
			staleRegistry: [...evaluated.staleRegistry, ...session.staleRegistry],
		};
		const context = {
			baseline: session.config.baseline,
			checked: session.inventory.sources.length,
			descriptions: new Map(session.config.active.map((rule) => [rule.id, rule.description])),
			registry: session.config.exceptions.length === 0 ? session.config.registry : `${relative(session.config.root, session.config.file)} exceptions`,
		};
		const deep = set === "full" ? session.config.active.filter((rule) => rule.depth === "deep").map((rule) => rule.id) : [...session.config.skipped];
		yield* Console.log([render(outcome, context), ...runSetLine(set, deep, config)].join("\n\n"));
		return { context, outcome };
	},
	(effect) =>
		withHeavyLock(effect, { command: "quality lint" }).pipe(
			Effect.catchTag("HeavyLockError", (cause) => new SetupFailure({ cause, message: cause.message })),
			Effect.provide(NodeCrypto.layerSecureRandom),
			Effect.provide(NodePath.layer),
		),
);

export const lint = Effect.fn("Cli.lint")(function* (cwd: string, config: string | undefined, requested: RunSet | undefined) {
	const { outcome } = yield* reportLint(cwd, config, false, requested);
	if (!passes(outcome)) {
		return yield* new GateFailed();
	}
});
