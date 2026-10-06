import { Effect } from "effect";
import { broken, cannotRun, unfinished } from "#internal/errors.ts";
import { type AnyEffect, type Hook, hooked } from "#internal/hooked.ts";
import type { RunUntilOptions } from "#storyKit.ts";

export interface LooseRunHooks<TEngine> {
	readonly diagnose?: Hook<[engine: TEngine], AnyEffect, string>;
	readonly failed?: Hook<[engine: TEngine], AnyEffect, string | undefined>;
	readonly maxSteps: number;
	readonly step: Hook<[engine: TEngine, tell: (line: string) => void], AnyEffect, void>;
}

export interface Running<TEngine> {
	readonly engine: TEngine;
	readonly name: string;
	readonly run: LooseRunHooks<TEngine> | undefined;
	readonly tell: (line: string) => void;
}

export const runUntil = Effect.fnUntraced(function* <TEngine>(
	{ engine, name, run, tell }: Running<TEngine>,
	until: Hook<[engine: TEngine], AnyEffect, boolean>,
	options: RunUntilOptions | undefined,
) {
	if (run === undefined) {
		return yield* Effect.die(cannotRun(name));
	}
	const { diagnose, failed, step } = run;
	const maxSteps = options?.maxSteps ?? run.maxSteps;
	for (let steps = 0; ; steps += 1) {
		const reason = failed === undefined ? undefined : yield* hooked(() => failed(engine));
		if (reason !== undefined) {
			return yield* Effect.die(broken(name, steps, reason));
		}
		if (yield* hooked(() => until(engine))) {
			return;
		}
		if (steps >= maxSteps) {
			return yield* Effect.die(unfinished(name, steps, diagnose === undefined ? undefined : yield* hooked(() => diagnose(engine))));
		}
		yield* hooked(() => step(engine, tell));
	}
});
