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

function run<A, E>(service: ErasedClient, effect: Effect.Effect<A, E, unknown>, owner?: BindingOwner) {
	return owner === undefined ? effect : Effect.suspend(() => AtomRegistry.getResult(owner.registry, service.runtime.atom(effect)));
}

function boundQuery(service: ErasedClient, tag: string, query: QueryShape, automatic: ReturnType<typeof automaticLive>, owner?: BindingOwner) {
	const reactive = queryReactivity(service.runtime, clientActivities.get(service)?.queued);
	const cached = new WeakMap<ReturnType<typeof service.query>, ReturnType<typeof service.query>>();
	return {
		query: (payload: unknown, options: QueryOptions = {}) => {
			const atom = service.query(tag, payload, options);
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
			const tracked = clientActivities.get(service)?.watch(result) ?? result;
			shareQuerySignals(tracked, result);
			cached.set(atom, tracked);
			return tracked;
		},
		run: (payload: unknown) =>
			run(
				service,
				service.use((client) => client(tag, payload)),
				owner,
			),
	};
}

function boundCommand(service: ErasedClient, tag: string, command: CommandShape, owner?: BindingOwner) {
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
				service,
				service.use((client) =>
					commandPayload(command, payload).pipe(
						Effect.tap(() => waitForConnection(client)),
						Effect.flatMap((validated) => client(tag, validated)),
						Effect.tap((result) => invalidate(payload, result)),
					),
				),
				owner,
			),
	};
}

function boundStream(service: ErasedStreamingClient, tag: string, owner?: BindingOwner) {
	return {
		run: (payload: unknown) => {
			const stream = Stream.unwrap(service.use((client) => Effect.succeed(client(tag, payload))));
			return owner === undefined
				? stream
				: Stream.callback<unknown, unknown>(
						(queue) => AtomRegistry.getResult(owner.registry, service.runtime.atom(Stream.runIntoQueue(stream, queue)).pipe(Atom.setIdleTTL(0))),
						{ bufferSize: 1 },
					);
		},
	};
}

export function clientOperations(
	service: AtomRpc.AtomRpcClient<unknown, string, Rpc.Any>,
	automatic: ReturnType<typeof automaticLive>,
	owner?: BindingOwner,
) {
	return {
		command: (tag: string, command: CommandShape) => boundCommand(service, tag, command, owner),
		query: (tag: string, query: QueryShape) => boundQuery(service, tag, query, automatic, owner),
		stream: (tag: string) => boundStream(service, tag, owner),
	};
}
