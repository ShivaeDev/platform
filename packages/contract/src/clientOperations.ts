import { Effect, Option, Schema, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc, RpcSchema } from "effect/rpc";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { BindingOwner } from "#adapters/bindingOwner.ts";
import { clientId } from "#adapters/clientId.ts";
import type { automaticLive } from "#automaticLive.ts";
import type { QueryOptions } from "#bind.ts";
import { clientActivities } from "#clientActivities.ts";
import { clientInvalidationKeys, clientReadKeys } from "#clientKeys.ts";
import { commandPayload } from "#commandPayload.ts";
import { waitForConnection } from "#connectionReadiness.ts";
import type { CommandShape, QueryShape } from "#operation.ts";
import { queryReactivity } from "#queryReactivity.ts";
import { shareQuerySignals } from "#querySignals.ts";

type ErasedClient = AtomRpc.AtomRpcClient<unknown, string, Rpc.Rpc<string, Schema.Top, Schema.Top, Schema.Top>>;
type ErasedStreamingClient = AtomRpc.AtomRpcClient<
	unknown,
	string,
	Rpc.Rpc<string, Schema.Top, RpcSchema.Stream<Schema.Top, Schema.Top>, Schema.Never>
>;

export function clientOperations(
	service: AtomRpc.AtomRpcClient<unknown, string, Rpc.Any>,
	automatic: ReturnType<typeof automaticLive>,
	owner?: BindingOwner,
) {
	const ordinaryClient: ErasedClient = service;
	const streaming: ErasedStreamingClient = service;
	function run<A, E>(effect: Effect.Effect<A, E, unknown>) {
		return owner === undefined ? effect : Effect.suspend(() => AtomRegistry.getResult(owner.registry, ordinaryClient.runtime.atom(effect)));
	}

	function boundQuery(tag: string, query: QueryShape) {
		const reactive = queryReactivity(ordinaryClient.runtime, clientActivities.get(ordinaryClient)?.queued);
		const cached = new WeakMap<ReturnType<typeof ordinaryClient.query>, ReturnType<typeof ordinaryClient.query>>();
		return {
			query: (payload: unknown, options: QueryOptions = {}) => {
				const atom = ordinaryClient.query(tag, payload, options);
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
					query.live === "rerun-and-compare",
					(source) => reactive(source, clientReadKeys(dependencies, owner?.context), owner?.registry),
					options.headers,
				);
				const tracked = clientActivities.get(ordinaryClient)?.watch(result) ?? result;
				shareQuerySignals(tracked, result);
				cached.set(atom, tracked);
				return tracked;
			},
			run: (payload: unknown) => run(ordinaryClient.use((client) => client(tag, payload))),
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
		return {
			run: (payload: unknown) =>
				run(
					ordinaryClient.use((client) =>
						commandPayload(command, payload).pipe(
							Effect.tap(() => waitForConnection(client)),
							Effect.flatMap((validated) => client(tag, validated)),
							Effect.tap((result) => invalidate(payload, result)),
						),
					),
				),
		};
	}

	function boundStream(tag: string) {
		return {
			run: (payload: unknown) => {
				const stream = Stream.unwrap(streaming.use((client) => Effect.succeed(client(tag, payload))));
				return owner === undefined
					? stream
					: Stream.callback<unknown, unknown>(
							(queue) => AtomRegistry.getResult(owner.registry, streaming.runtime.atom(Stream.runIntoQueue(stream, queue)).pipe(Atom.setIdleTTL(0))),
							{ bufferSize: 1 },
						);
			},
		};
	}

	return {
		command: (tag: string, command: CommandShape) => boundCommand(tag, command),
		query: (tag: string, query: QueryShape) => boundQuery(tag, query),
		stream: (tag: string) => boundStream(tag),
	};
}
