import { type Context, Effect, type Schema } from "effect";
import { decodeRejection, rejectionOf } from "#rejectionDecoding.ts";
import { failureOf } from "./http.ts";
import { type RouterEngine, running } from "./routerEngine.ts";

export function routerVerbs(engine: RouterEngine, tell: (line: string) => void) {
	const host = running(engine);
	const subscriptions = new WeakMap<AsyncIterator<unknown>, string>();
	function query(path: string, input?: unknown) {
		tell(`query ${path}`);
		return host.client.query(path, input);
	}
	function mutate(path: string, input?: unknown) {
		tell(`mutate ${path}`);
		return host.client.mutation(path, input);
	}
	function subscribe<R>(path: string, input: unknown, services?: Context.Context<R>, signal?: AbortSignal) {
		return Effect.acquireRelease(
			Effect.promise(async () => {
				tell(`subscribe to ${path}`);
				function start() {
					return host.subscribe(path, input, signal);
				}
				const stream = await (services === undefined ? start() : host.runWithServices(services, start));
				const iterator = stream[Symbol.asyncIterator]();
				subscriptions.set(iterator, path);
				return iterator;
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
		callerQuery: <R>(path: string, services: Context.Context<R>, input?: unknown, signal?: AbortSignal) => {
			tell(`call ${path} with ambient services`);
			return Effect.promise(() => host.runWithServices(services, () => host.call(path, input, signal)));
		},
		consume: (path: string, input?: unknown) =>
			Effect.promise(async () => {
				tell(`consume the ${path} subscription`);
				const values: unknown[] = [];
				for await (const value of await host.subscribe(path, input)) {
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
		mutate: (path: string, input?: unknown) => Effect.promise(() => mutate(path, input)),
		next: (iterator: AsyncIterator<unknown>) => {
			tell(`read the next value from ${subscriptions.get(iterator) ?? "the subscription"}`);
			return Effect.promise(() => iterator.next());
		},
		query: (path: string, input?: unknown) => Effect.promise(() => query(path, input)),
		rejectCaller: (path: string, input?: unknown, signal?: AbortSignal) => {
			tell(`call ${path}`);
			return Effect.promise(() => failureOf(host.call(path, input, signal)));
		},
		rejection: (error: unknown) => {
			tell("read the formatted rejection");
			return rejectionOf(error);
		},
		rejectMutation: (path: string, input?: unknown) => Effect.promise(() => failureOf(mutate(path, input))),
		rejectNext: (iterator: AsyncIterator<unknown>) => {
			tell(`read the next rejection from ${subscriptions.get(iterator) ?? "the subscription"}`);
			return Effect.promise(() => failureOf(iterator.next()));
		},
		rejectQuery: (path: string, input?: unknown) => Effect.promise(() => failureOf(query(path, input))),
		rejectSubscription: (path: string, input?: unknown) => {
			tell(`subscribe to ${path}`);
			return Effect.promise(() => failureOf(host.subscribe(path, input)));
		},
		started: (iterator: AsyncIterator<unknown>) =>
			Effect.suspend(() => {
				const path = subscriptions.get(iterator);
				tell(`wait for ${path ?? "the subscription"} to start`);
				const start = path === undefined ? undefined : host.starts?.get(path);
				if (start === undefined) {
					throw new Error(`Subscription ${path ?? "from an unknown iterator"} cannot report a start`);
				}
				return Effect.promise(() => start);
			}),
		subscribe: (path: string, input?: unknown, signal?: AbortSignal) => subscribe(path, input, undefined, signal),
		subscribeWith: <R>(path: string, services: Context.Context<R>, input?: unknown) => subscribe(path, input, services),
	};
}
