import { Effect, Schema, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc } from "effect/rpc";
import type { BindingOwner } from "#adapters/bindingOwner.ts";
import { streamingClient, unaryClient } from "#adapters/erasedClient.ts";
import type { automaticLive } from "#automaticLive.ts";
import type { QueryOptions, RunOptions } from "#bind.ts";
import { clientActivities } from "#clientActivities.ts";
import { commandPayload } from "#commandPayload.ts";
import { COMMAND_REFLECTED } from "#commandReflected.ts";
import { CommandSignal, untilReflected } from "#commandSignal.ts";
import { waitForConnection } from "#connectionReadiness.ts";
import { LIVE_SYNC } from "#liveSyncRpc.ts";
import type { CommandShape, QueryShape } from "#operation.ts";
import { type CommandObserver, reflectCommand } from "#reflectCommand.ts";
import { retainQuery } from "#retainQuery.ts";
import { storedForm } from "#storedQueries.ts";
import { inputSubject, subjectSerializationKey, withSubject } from "#subjectHeader.ts";
import { warmQueries } from "#warmQueries.ts";

// `runtime.fn(api.save.run)` passes its function context as the second argument, so only an options object selects a subject.
function runSubject(options: unknown): string | undefined {
	return typeof options === "object" && options !== null && "subject" in options && typeof options.subject === "string" ? options.subject : undefined;
}

export function clientOperations(
	service: AtomRpc.AtomRpcClient<unknown, string, Rpc.Any>,
	automatic: ReturnType<typeof automaticLive>,
	owner?: BindingOwner,
) {
	const ordinaryClient = unaryClient(service);
	const streaming = streamingClient(service);
	function run<A, E>(effect: Effect.Effect<A, E, unknown>) {
		return owner === undefined ? effect : Effect.suspend(() => AtomRegistry.getResult(owner.registry, ordinaryClient.runtime.atom(effect)));
	}

	const observed = Effect.gen(function* () {
		const signal = yield* CommandSignal;
		const reactivity = yield* Reactivity.Reactivity;
		return yield* Effect.sync(
			(): CommandObserver => ({
				pending: () => clientActivities.get(ordinaryClient)?.reflecting() ?? (() => undefined),
				signal: (state) => {
					signal(state);
					if (state === "reflected") {
						reactivity.invalidateUnsafe([COMMAND_REFLECTED]);
					}
				},
			}),
		);
	});

	function boundQuery(tag: string, query: QueryShape) {
		const cached = new WeakMap<ReturnType<typeof ordinaryClient.query>, ReturnType<typeof ordinaryClient.query>>();
		const stored = storedForm(tag, query);
		return {
			query: (payload: unknown, { headers: given, serializationKey, subject }: QueryOptions = {}) => {
				const headers = withSubject(given, subject);
				const atom = ordinaryClient.query(tag, payload, {
					headers,
					serializationKey: subjectSerializationKey(serializationKey, headers),
					timeToLive: 0,
				});
				const existing = cached.get(atom);
				if (existing !== undefined) {
					return existing;
				}
				const reference = { payload, query: query.name };
				const result = automatic.query(
					atom,
					reference,
					Schema.toEquivalence(query.success),
					Schema.decodeUnknownSync(Schema.toType(query.success)),
					headers,
				);
				function warm(get: Atom.AtomContext): boolean {
					return get.once(warmQueries).has(tracked);
				}
				const watched = clientActivities.get(ordinaryClient)?.watch(result, warm) ?? result;
				const tracked = retainQuery(ordinaryClient.runtime, watched, stored(payload, inputSubject(headers)));
				cached.set(atom, tracked);
				return tracked;
			},
			run: (payload: unknown, options?: RunOptions | Atom.FnContext) =>
				run(ordinaryClient.use((client) => client(tag, payload, { headers: withSubject(undefined, runSubject(options)) }))),
			runtime: ordinaryClient.runtime,
		};
	}

	function boundCommand(tag: string, command: CommandShape) {
		function send(observer: CommandObserver, payload: unknown, subject: string | undefined) {
			return ordinaryClient.use((client) =>
				commandPayload(command, payload).pipe(
					Effect.tap(() => waitForConnection(client)),
					Effect.flatMap((validated) =>
						reflectCommand(client, observer, (options) => client(tag, validated, { headers: withSubject(options?.headers, subject) })),
					),
				),
			);
		}
		return {
			payload: command.payload,
			run: (payload: unknown, options?: RunOptions | Atom.FnContext) =>
				Effect.flatMap(observed, (observer) => run(send(observer, payload, runSubject(options)))),
			runtime: ordinaryClient.runtime,
		};
	}

	function synchronize(observer: CommandObserver) {
		return ordinaryClient.use((client) => {
			const request = reflectCommand(client, observer, (options) => Effect.asVoid(client(LIVE_SYNC, undefined, options)), true);
			return Effect.andThen(waitForConnection(client), request);
		});
	}
	// A sync writes nothing and waits like a command, so it returns once every open live query shows the commits before it.
	const sync = untilReflected(Effect.flatMap(observed, (observer) => run(synchronize(observer))));

	function boundStream(tag: string) {
		return {
			run: (payload: unknown, options?: RunOptions | Atom.FnContext) => {
				const stream = Stream.unwrap(
					streaming.use((client) => Effect.succeed(client(tag, payload, { headers: withSubject(undefined, runSubject(options)) }))),
				);
				return owner === undefined
					? stream
					: Stream.callback<unknown, unknown>(
							(queue) => AtomRegistry.getResult(owner.registry, streaming.runtime.atom(Stream.runIntoQueue(stream, queue)).pipe(Atom.setIdleTTL(0))),
							{ bufferSize: 1 },
						);
			},
			runtime: streaming.runtime,
		};
	}

	return {
		command: (tag: string, command: CommandShape) => boundCommand(tag, command),
		query: (tag: string, query: QueryShape) => boundQuery(tag, query),
		stream: (tag: string) => boundStream(tag),
		sync,
	};
}
