import { Effect, Layer, Schema, Stream } from "effect";
import type { EffectTRPCAdapter } from "#adapter.ts";
import { makeRequestServices } from "#request-services.ts";
import { RequestSignal } from "#request-signal.ts";
import type { serverTrpc } from "./adapterHost.ts";
import { type Dependency, RequestValue, type RuntimeOnlyValue, RuntimeValue } from "./adapterServices.ts";
import type { RouterEngine } from "./routerEngine.ts";

export function adapterSubscriptions(
	engine: RouterEngine,
	adapter: EffectTRPCAdapter<RuntimeValue | RuntimeOnlyValue | Dependency>,
	t: ReturnType<typeof serverTrpc>,
) {
	const procedure = adapter.procedure(
		t.procedure,
		makeRequestServices((context: { readonly requestId: string }) => Layer.succeed(RequestValue, context.requestId)),
	);
	return {
		ambientStream: procedure.subscription(function* () {
			return yield* Effect.succeed(Stream.fromEffect(RuntimeValue));
		}),
		failedStream: procedure.subscription(function* () {
			return yield* Effect.succeed(Stream.fail("subscription unavailable"));
		}),
		interruptible: procedure.subscription(function* () {
			return Stream.scoped(
				Stream.fromEffect(
					Effect.acquireRelease(
						Effect.sync(() => engine.streamStarted.resolve()),
						() => Effect.sync(() => engine.finalized.push("interruptible")),
					),
				),
			).pipe(Stream.flatMap(() => Stream.never));
		}),
		neverStream: procedure.subscription(function* () {
			return yield* Effect.succeed(Stream.never);
		}),
		stream: procedure.subscription(function* () {
			const request = yield* RequestValue;
			const signal = yield* RequestSignal;
			return Stream.scoped(
				Stream.fromEffect(Effect.acquireRelease(Effect.succeed(request), (value) => Effect.sync(() => engine.finalized.push(value)))),
			).pipe(Stream.flatMap((value) => Stream.make(`${value}:one`, `${value}:two`, String(signal))));
		}),
		transformedStream: procedure.output(Schema.NumberFromString).subscription(function* () {
			return yield* Effect.succeed(Stream.make("42", "43"));
		}),
	};
}
