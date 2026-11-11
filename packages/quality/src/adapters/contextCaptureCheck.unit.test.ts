import { describe, expect, it } from "vitest";
import { contextCaptureCheck } from "#adapters/contextCaptureCheck.ts";
import { linesOf } from "#inventory/linesOf.ts";

const EFFECT = 'import { Effect, Layer } from "effect";\n';

function checks(path: string, text: string): boolean {
	return contextCaptureCheck.checks({ lines: linesOf(text), path, text });
}

describe("contextCaptureCheck.checks", () => {
	for (const [shape, text] of [
		["a runner call", `${EFFECT}Effect.runPromiseWith(context)(effect);`],
		["an aliased import", 'import { runPromiseWith as run } from "effect/Effect"; run(context)(effect);'],
		["a destructured runner", 'import * as Fx from "effect/Effect"; const { runForkWith: fork } = Fx; fork(context)(effect);'],
		["a local alias", `${EFFECT}const give = Effect.provideContext; give(effect, context);`],
		["provide with a value that may be a Context", `${EFFECT}Effect.provide(effect, environment);`],
		["provide in a pipe", `${EFFECT}effect.pipe(Effect.provide(services.context));`],
	] as const) {
		it(`type-checks a file with ${shape}`, () => {
			expect(checks("src/run.ts", text)).toBe(true);
		});
	}

	for (const [shape, text] of [
		["provide with a Layer expression", `${EFFECT}Effect.provide(effect, Layer.mergeAll(StoreLive, ClockLive));`],
		["provide with a name ending in Layer", `${EFFECT}effect.pipe(Effect.provide(storeLayer));`],
		["provide with a layer member", `${EFFECT}Effect.provide(effect, Store.layer);`],
		["provide only in text", `${EFFECT}// provideContext would hide requirements\nconst label = "runPromiseWith";`],
	] as const) {
		it(`leaves out a file with ${shape}`, () => {
			expect(checks("src/run.ts", text)).toBe(false);
		});
	}

	it("leaves out a runtime bridge in adapters/", () => {
		expect(checks("src/adapters/run.ts", `${EFFECT}Effect.runPromiseWith(context)(effect);`)).toBe(false);
	});
});
