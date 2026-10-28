import { Effect, Option, type Schema, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc, RpcSchema } from "effect/rpc";
import { invalidationKeys, type Key, readKeys } from "@shivaedev/changes/keys.ts";
import type { automaticLive } from "#automaticLive.ts";
import type { QueryOptions } from "#bind.ts";
import type { CommandShape, QueryShape } from "#operation.ts";
import { MissingReadPolicy } from "#readPolicyErrors.ts";
import type { BindingOwner } from "./bindingOwner.ts";
import { queryReactivity } from "./queryReactivity.ts";

type ErasedClient = AtomRpc.AtomRpcClient<unknown, string, Rpc.Rpc<string, Schema.Top, Schema.Top, Schema.Top>>;

const queryIds = new WeakMap<object, number>();
let nextQueryId = 0;

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
			if (query.readPolicy === undefined) {
				return service.runtime.atom(
					Effect.fail(new MissingReadPolicy({ message: `Declare a readPolicy on query ${query.name} before running it live or subscribing` })),
				);
			}
			const atom = service.query(tag, payload, options);
			let id = queryIds.get(atom);
			if (id === undefined) {
				id = nextQueryId;
				nextQueryId += 1;
				queryIds.set(atom, id);
			}
			const local = query.reads(payload, Option.none());
			const keys = [...local, { _tag: "List" as const, collection: `@query/${tag}/${id}` }];
			const dependencies =
				local.length === 0 ? [...keys, { _tag: "List" as const, collection: `@query/${tag.slice(0, tag.lastIndexOf("."))}` }] : keys;
			const reference = { payload, query: query.name };
			if (owner === undefined) {
				track(undefined, reference, keys);
			}
			return reactive(
				atom,
				readKeys(dependencies, owner?.context),
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
	function invalidate(payload: unknown, result: unknown) {
		const keys: readonly Key[] = [
			...command.invalidates(payload, result),
			{ _tag: "List", collection: `@query/${tag.slice(0, tag.lastIndexOf("."))}` },
		];
		return Reactivity.invalidate(invalidationKeys(keys, owner?.context));
	}
	return {
		run: (payload: unknown) =>
			run(service, service.use((client) => client(tag, payload)).pipe(Effect.tap((result) => invalidate(payload, result))), owner),
	};
}

export function boundStream(service: ErasedStreamingClient, tag: string) {
	return {
		run: (payload: unknown) => Stream.unwrap(service.use((client) => Effect.succeed(client(tag, payload)))),
	};
}
