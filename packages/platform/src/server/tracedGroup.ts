import type { Rpc, RpcGroup } from "effect/rpc";
import { RequestTracing } from "#rpc/middleware.ts";

export function tracedGroup<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>) {
	const traced = group.middleware(RequestTracing);
	for (const rpc of traced.requests.values()) {
		const middlewares = new Set(rpc.middlewares);
		middlewares.delete(RequestTracing);
		middlewares.add(RequestTracing);
		// Native middleware() clones each RPC but cannot move an existing middleware to the outermost position.
		Object.assign(rpc, { middlewares });
	}
	return traced;
}
