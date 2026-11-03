import { Effect } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";

type WithMiddlewares = Rpc.Any & { readonly middlewares: ReadonlySet<{ readonly key: string }> };

export const prependMiddleware = Effect.fnUntraced(function* <R extends WithMiddlewares>(group: RpcGroup.RpcGroup<R>, key: string) {
	return yield* Effect.sync(() => {
		// Native middleware runs in reverse order; identity must supply the viewer before this guard runs.
		for (const rpc of group.requests.values()) {
			const middlewares = [...rpc.middlewares].sort((left, right) => Number(right.key === key) - Number(left.key === key));
			Object.assign(rpc, { middlewares: new Set(middlewares) });
		}
		return group;
	});
});
