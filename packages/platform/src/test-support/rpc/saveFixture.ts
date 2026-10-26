import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Conflict, InternalServerError, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { RequestTracing } from "#rpc/middleware.ts";
import { rpcBoundary } from "#server/rpc-server/boundary.ts";

const Rejection = Schema.Union([Conflict, InternalServerError, ServiceUnavailable]);
export const Api = RpcGroup.make(Rpc.make("Save", { error: Rejection, payload: { mode: Schema.String }, success: Schema.String })).middleware(
	RequestTracing,
);
export const original = new Error("Storage failed with password=private-value");
export const Handlers = Api.toLayer({
	Save: ({ mode }) =>
		Effect.suspend(() => {
			if (mode === "conflict") {
				return Effect.fail(new Conflict({ field: "name", message: "Name is taken" }));
			}
			if (mode === "unavailable") {
				return Effect.fail(new ServiceUnavailable({ message: "Storage is unavailable" }));
			}
			return mode === "defect" ? Effect.die(original) : Effect.fail(original);
		}).pipe(rpcBoundary(Rejection, { unexpected: (message) => new InternalServerError({ message }) })),
});
