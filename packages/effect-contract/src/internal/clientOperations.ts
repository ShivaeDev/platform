import { Effect, type Schema, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc, RpcSchema } from "effect/rpc";
import type { automaticLive } from "#automaticLive.ts";
import type { QueryOptions } from "#bind.ts";
import { invalidationKeys, readKeys } from "#keys.ts";
import type { CommandShape, QueryShape } from "#operation.ts";
import type { BindingOwner } from "./bindingOwner.ts";
import { queryReactivity } from "./queryReactivity.ts";

type ErasedClient = AtomRpc.AtomRpcClient<unknown, string, Rpc.Rpc<string, Schema.Top, Schema.Top, Schema.Top>>;

type ErasedStreamingClient = AtomRpc.AtomRpcClient<
	unknown,
	string,
	Rpc.Rpc<string, Schema.Top, RpcSchema.Stream<Schema.Top, Schema.Top>, Schema.Never>
>;

function run<A, E>(service: ErasedClient, effect: Effect.Effect<A, E, unknown>, owner?: BindingOwner) {
	return owner === undefined ? effect : Effect.suspend(() => AtomRegistry.getResult(owner.registry, service.runtime.atom(effect)));
}

export function boundQuery(
	service: ErasedClient,
	tag: string,
	query: QueryShape,
	track: ReturnType<typeof automaticLive>["track"],
	owner?: BindingOwner,
) {
	const reactive = queryReactivity(service.runtime);
	return {
		query: (payload: unknown, options: QueryOptions = {}) => {
			const atom = service.query(tag, payload, options);
			const keys = query.reads(payload);
			const reference = { payload, query: query.name };
			if (owner === undefined) {
				track(undefined, reference, keys);
			}
			return reactive(
				atom,
				readKeys(keys, owner?.context),
				(registry) => (owner === undefined ? () => undefined : track(registry, reference, keys)),
				owner?.registry,
			);
		},
		run: (payload: unknown) =>
			run(
				service,
				service.use((client) => client(tag, payload)),
				owner,
			),
	};
}

export function boundCommand(service: ErasedClient, tag: string, command: CommandShape, owner?: BindingOwner) {
	return {
		run: (payload: unknown) =>
			run(
				service,
				service
					.use((client) => client(tag, payload))
					.pipe(Effect.tap((result) => Reactivity.invalidate(invalidationKeys(command.invalidates(payload, result), owner?.context)))),
				owner,
			),
	};
}

export function boundStream(service: ErasedStreamingClient, tag: string) {
	return {
		run: (payload: unknown) => Stream.unwrap(service.use((client) => Effect.succeed(client(tag, payload)))),
	};
}
