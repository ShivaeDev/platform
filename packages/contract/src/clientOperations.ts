import { Effect, Option, Schema, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc } from "effect/rpc";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { BindingOwner } from "#adapters/bindingOwner.ts";
import { clientId } from "#adapters/clientId.ts";
import { streamingClient, unaryClient } from "#adapters/erasedClient.ts";
import type { automaticLive } from "#automaticLive.ts";
import type { QueryOptions, RunOptions } from "#bind.ts";
import { clientActivities } from "#clientActivities.ts";
import { clientInvalidationKeys, clientReadKeys } from "#clientKeys.ts";
import { commandPayload } from "#commandPayload.ts";
import { CommandSignal, untilReflected } from "#commandSignal.ts";
import { waitForConnection } from "#connectionReadiness.ts";
import { LIVE_SYNC } from "#liveSyncRpc.ts";
import type { CommandShape, QueryShape } from "#operation.ts";
import { shareQuerySignals } from "#querySignals.ts";
import { type CommandObserver, reflectCommand } from "#reflectCommand.ts";
import { retainQuery } from "#retainQuery.ts";
import { subjectSerializationKey, withSubject } from "#subjectHeader.ts";
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

	const observed = Effect.map(
		CommandSignal,
		(signal): CommandObserver => ({ pending: () => clientActivities.get(ordinaryClient)?.reflecting() ?? (() => undefined), signal }),
	);

	function boundQuery(tag: string, query: QueryShape) {
		const cached = new WeakMap<ReturnType<typeof ordinaryClient.query>, ReturnType<typeof ordinaryClient.query>>();
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
				const local = query.reads(payload, Option.none());
				const keys = [...local, { _tag: "List" as const, collection: `@query/${tag}/${clientId()}` }];
				const dependencies =
					local.length === 0 ? [...keys, { _tag: "List" as const, collection: `@query/${tag.slice(0, tag.lastIndexOf("."))}` }] : keys;
				const reference = { payload, query: query.name };
				const result = automatic.query(
					atom,
					reference,
					keys,
					Schema.toEquivalence(query.success),
					Schema.decodeUnknownSync(Schema.toType(query.success)),
					(source) => ordinaryClient.runtime.factory.withReactivity(clientReadKeys(dependencies, owner?.context))(source),
					headers,
				);
				function warm(get: Atom.AtomContext): boolean {
					return get.once(warmQueries).has(tracked);
				}
				const tracked = retainQuery(ordinaryClient.runtime, clientActivities.get(ordinaryClient)?.watch(result, warm) ?? result);
				shareQuerySignals(tracked, result);
				cached.set(atom, tracked);
				return tracked;
			},
			run: (payload: unknown, options?: RunOptions | Atom.FnContext) =>
				run(ordinaryClient.use((client) => client(tag, payload, { headers: withSubject(undefined, runSubject(options)) }))),
			runtime: ordinaryClient.runtime,
		};
	}

	function boundCommand(tag: string, command: CommandShape) {
		function invalidate(payload: unknown, result: unknown) {
			const keys: readonly Key[] = [
				...command.invalidates(payload, result),
				{ _tag: "List", collection: `@query/${tag.slice(0, tag.lastIndexOf("."))}` },
			];
			return Reactivity.invalidate(clientInvalidationKeys(keys, owner?.context));
		}
		function send(observer: CommandObserver, payload: unknown, subject: string | undefined) {
			return ordinaryClient.use((client) =>
				commandPayload(command, payload).pipe(
					Effect.tap(() => waitForConnection(client)),
					Effect.flatMap((validated) =>
						reflectCommand(client, observer, (options) => client(tag, validated, { headers: withSubject(options?.headers, subject) })),
					),
					Effect.tap((result) => invalidate(payload, result)),
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
