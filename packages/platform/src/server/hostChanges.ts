import { Context, Effect, Layer, Option } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import type { AppChanges } from "./appHost.ts";

export function hostChanges<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, changesService: typeof AppChanges) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const changes = yield* Effect.serviceOption(changesService);
			if (Option.isNone(changes)) {
				return Context.empty();
			}
			const live = changes.value;
			const services = yield* Effect.context<never>();
			const handlers = new Map<string, unknown>();
			for (const rpc of group.requests.values()) {
				if (!rpc._tag.endsWith(".$changes")) {
					continue;
				}
				function handler({ keys }: { readonly keys: Parameters<typeof live.stream>[0] }) {
					return live.stream(keys);
				}
				handlers.set(rpc.key, { context: services, handler, tag: rpc._tag });
			}
			return Context.makeUnsafe(handlers);
		}),
	);
}
