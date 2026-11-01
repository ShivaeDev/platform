import { it as effectIt, type TestContext } from "@effect/vitest";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import type * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import type { EffectClock, EffectTestBody } from "#types.ts";
import { withLive } from "#withLive.ts";
import { type AnyTestLayer, buildTestLayer } from "./anyTestLayer.ts";
import { runEffectTest } from "./runEffectTest.ts";

export function fixtureIt<THarness, TLayer extends AnyTestLayer>(
	layer: TLayer,
	run: <A>(
		body: EffectTestBody<THarness, Layer.Success<TLayer>, A>,
		context: TestContext,
		services: Context.Context<Layer.Success<TLayer>>,
	) => Effect.Effect<A, unknown, Scope.Scope>,
) {
	const withLayer = effectIt.extend("__effectTestContext", { scope: "file" }, ({}, { onCleanup }) => {
		const scope = Effect.runSync(Scope.make());
		onCleanup(() => Effect.runPromise(Scope.close(scope, Exit.void)));
		return Effect.runSync(Effect.cached(withLive(buildTestLayer(layer).pipe(Effect.provideService(Scope.Scope, scope)))));
	});

	return withLayer.extend("__effectTestRun", ({ __effectTestContext, task }) => {
		const context = task.context;
		return <A>(body: EffectTestBody<THarness, Layer.Success<TLayer>, A>, clock: EffectClock) =>
			runEffectTest(Effect.flatMap(__effectTestContext, (services) => run(body, context, services)).pipe(Effect.asVoid), context, clock);
	});
}
