import { type Context, Effect, type Schema } from "effect";
import { decodeRejection, rejectionOf } from "#rejectionDecoding.ts";
import { failureOf } from "./http.ts";
import { type RouterEngine, running } from "./routerEngine.ts";

export function routerVerbs(engine: RouterEngine, tell: (line: string) => void) {
	const host = running(engine);
	function query(path: string, input = engine.input) {
		tell(`query ${path}`);
		return host.client.query(path, input);
	}
	function mutate(path: string, input = engine.input) {
		tell(`mutate ${path}`);
		return host.client.mutation(path, input);
	}
	function subscribe<R>(path: string, services?: Context.Context<R>, signal?: AbortSignal) {
		return Effect.acquireRelease(
			Effect.promise(async () => {
				tell(`subscribe to ${path}`);
				function start() {
					return host.subscribe(path, engine.input, signal);
				}
				const stream = await (services === undefined ? start() : host.runWithServices(services, start));
				return stream[Symbol.asyncIterator]();
			}),
			(iterator) =>
				Effect.promise(async () => {
					await iterator.return?.();
				}),
		);
	}
	return {
		batch: (calls: readonly { path: string; input: unknown }[]) => {
			tell(`send a batch of ${calls.length} mutations`);
			return Effect.promise(() => Promise.allSettled(calls.map(({ path, input }) => mutate(path, input))));
		},
		callerQuery: <R>(path: string, services: Context.Context<R>, signal?: AbortSignal) => {
			tell(`call ${path} with ambient services`);
			return Effect.promise(() => host.runWithServices(services, () => host.call(path, engine.input, signal)));
		},
		consume: (path: string) =>
			Effect.promise(async () => {
				tell(`consume the ${path} subscription`);
				const values: unknown[] = [];
				for await (const value of await host.subscribe(path, engine.input)) {
					values.push(value);
				}
				return values;
			}),
		decode: <TSchema extends Schema.ConstraintDecoder<{ readonly _tag: string }>>(schema: TSchema, error: unknown) => {
			tell("decode the rejection with its declared schema");
			return decodeRejection(schema)(error);
		},
		exchanges: host.http.exchanges,
		finalized: engine.finalized,
		formatting: engine.formatting,
		instrumented: engine.instrumented,
		instrumentedRequests: engine.instrumentedRequests,
		instrumentedStreams: engine.instrumentedStreams,
		mapped: engine.mapped,
		mutate: (path: string, input = engine.input) => Effect.promise(() => mutate(path, input)),
		next: (iterator: AsyncIterator<unknown>) => Effect.promise(() => iterator.next()),
		query: (path: string, input = engine.input) => Effect.promise(() => query(path, input)),
		rejectCaller: (path: string, signal?: AbortSignal) => {
			tell(`call ${path}`);
			return Effect.promise(() => failureOf(host.call(path, engine.input, signal)));
		},
		rejection: (error: unknown) => {
			tell("read the formatted rejection");
			return rejectionOf(error);
		},
		rejectMutation: (path: string, input = engine.input) => Effect.promise(() => failureOf(mutate(path, input))),
		rejectNext: (iterator: AsyncIterator<unknown>) => Effect.promise(() => failureOf(iterator.next())),
		rejectQuery: (path: string, input = engine.input) => Effect.promise(() => failureOf(query(path, input))),
		rejectSubscription: (path: string) => {
			tell(`subscribe to ${path}`);
			return Effect.promise(() => failureOf(host.subscribe(path, engine.input)));
		},
		started: () => Effect.promise(() => engine.streamStarted.promise),
		subscribe: (path: string, signal?: AbortSignal) => subscribe(path, undefined, signal),
		subscribeWith: <R>(path: string, services: Context.Context<R>) => subscribe(path, services),
	};
}
