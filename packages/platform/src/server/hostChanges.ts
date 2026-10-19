import { Context, Effect, Layer, Option, Stream } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import type { Key } from "@shivaedev/effect-contract/keys.ts";
import type { AppChanges } from "./appHost.ts";

export function hostChanges<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, changesService: typeof AppChanges) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const changes = yield* Effect.serviceOption(changesService);
			const services = yield* Effect.context<never>();
			const handlers = new Map<string, unknown>();
			for (const rpc of group.requests.values()) {
				if (!rpc._tag.endsWith(".$changes")) {
					continue;
				}
				const provided = services.mapUnsafe.get(rpc.key);
				if (Option.isNone(changes) && provided !== undefined) {
					handlers.set(rpc.key, provided);
					continue;
				}
				function handler({ keys }: { readonly keys: readonly Key[] }) {
					return Option.isSome(changes) ? changes.value.stream(keys) : Stream.never;
				}
				handlers.set(rpc.key, { context: services, handler, tag: rpc._tag });
			}
			return Context.makeUnsafe<Rpc.ToHandler<Extract<R, { readonly _tag: `${string}.$changes` }>>>(handlers);
		}),
	);
}
