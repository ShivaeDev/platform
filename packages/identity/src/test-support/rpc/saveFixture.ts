import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { Conflict, InternalServerError, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { RequestTracing } from "#middleware.ts";

export const SaveOutcome = Schema.Literals(["name taken", "storage unavailable", "storage fails", "storage crashes"]);

const Rejection = Schema.Union([Conflict, InternalServerError, ServiceUnavailable]);
export const Api = RpcGroup.make(
	Rpc.make("Save", { error: Rejection, payload: { outcome: SaveOutcome, storageDetail: Schema.String }, success: Schema.String }),
).middleware(RequestTracing);
export const Handlers = Api.toLayer({
	Save: ({ outcome, storageDetail }) =>
		Effect.suspend(() => {
			if (outcome === "name taken") {
				return Effect.fail(new Conflict({ field: "name", message: "Name is taken" }));
			}
			if (outcome === "storage unavailable") {
				return Effect.fail(new ServiceUnavailable({ message: "Storage is unavailable" }));
			}
			const storageError = new Error(`Storage failed with ${storageDetail}`);
			return outcome === "storage crashes" ? Effect.die(storageError) : Effect.fail(storageError);
		}).pipe(rpcBoundary(Rejection, { unexpected: (message) => new InternalServerError({ message }) })),
});
