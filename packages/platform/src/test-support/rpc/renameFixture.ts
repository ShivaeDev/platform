import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { BadRequest, Conflict, NotFound, PreconditionFailed, TooManyRequests } from "#errors/taxonomy.ts";

const Rejection = Schema.Union([NotFound, BadRequest, Conflict, PreconditionFailed, TooManyRequests]);
export const Profiles = RpcGroup.make(Rpc.make("Rename", { error: Rejection, payload: { name: Schema.String }, success: Schema.String }));
export const Handlers = Profiles.toLayer({
	Rename: ({ name }) => {
		if (name === "") {
			return Effect.fail(new BadRequest({ field: "name", message: "Name is required" }));
		}
		if (name === "taken") {
			return Effect.fail(new Conflict({ field: "name", message: "Name is taken" }));
		}
		if (name === "stale") {
			return Effect.fail(new PreconditionFailed({ message: "Profile changed" }));
		}
		if (name === "missing") {
			return Effect.fail(new NotFound({ message: "No profile" }));
		}
		if (name === "busy") {
			return Effect.fail(new TooManyRequests({ message: "Slow down" }));
		}
		return Effect.succeed(name);
	},
});
