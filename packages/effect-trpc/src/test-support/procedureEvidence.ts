import { initTRPC } from "@trpc/server";
import { Effect, Layer, ManagedRuntime, Stream, Tracer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeEffectTRPC } from "#server/adapter.ts";
import { RequestSignal } from "#server/RequestSignal.ts";
import { makeRequestServices } from "#server/requestServices.ts";

function* create() {
	const spans: Tracer.NativeSpan[] = [];
	const aborted: boolean[] = [];
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			spans.push(span);
			return span;
		},
	});
	const runtime = yield* Effect.acquireRelease(
		Effect.sync(() => ManagedRuntime.make(Layer.succeed(Tracer.Tracer, tracer))),
		(value) => Effect.promise(() => value.dispose()),
	);
	const t = initTRPC.create();
	const procedure = makeEffectTRPC({ runtime }).procedure(
		t.procedure,
		makeRequestServices(() => Layer.empty),
	);
	const router = t.router({
		orders: t.router({
			read: procedure.query(function* () {
				return yield* Effect.succeed("read").pipe(Effect.withSpan("resolver.query"));
			}),
			signal: procedure.subscription(function* () {
				const signal = yield* RequestSignal;
				return Stream.scoped(
					Stream.fromEffect(Effect.acquireRelease(Effect.succeed(signal), (value) => Effect.sync(() => aborted.push(value?.aborted === true)))),
				).pipe(Stream.concat(Stream.never));
			}),
			updates: procedure.subscription(function* () {
				yield* Effect.void.pipe(Effect.withSpan("resolver.subscription"));
				return Stream.make("first", "second");
			}),
			write: procedure.mutation(function* () {
				return yield* Effect.succeed("written").pipe(Effect.withSpan("resolver.mutation"));
			}),
		}),
	});
	return { aborted, router, spans };
}

export const procedureEvidence = storyKit({
	clock: "live",
	create,
	name: "tRPC procedure",
	stages: ["ready"],
	verbs: ({ aborted, router, spans }, story) => ({
		aborted,
		read: () => {
			story.tell("a caller queries orders.read");
			return Effect.promise(() => router.createCaller({}).orders.read());
		},
		signal: (signal: AbortSignal) =>
			Effect.acquireRelease(
				Effect.promise(async () => {
					story.tell("a caller subscribes with an abort signal");
					const stream = await router.createCaller({}, { signal }).orders.signal();
					return stream[Symbol.asyncIterator]();
				}),
				(iterator) =>
					Effect.promise(async () => {
						await iterator.return?.();
					}),
			),
		spans,
		updates: () =>
			Effect.promise(async () => {
				story.tell("a caller consumes orders.updates");
				const values: string[] = [];
				for await (const value of await router.createCaller({}).orders.updates()) {
					values.push(value);
				}
				return values;
			}),
		write: () => {
			story.tell("a caller mutates orders.write");
			return Effect.promise(() => router.createCaller({}).orders.write());
		},
	}),
});
