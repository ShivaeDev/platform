import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { BadRequest, Conflict, Forbidden, NotFound, PreconditionFailed, TooManyRequests } from "#errors/taxonomy.ts";

export class Invalid extends Schema.TaggedError<Invalid>()("Invalid", { field: Schema.Literals(["title"]), message: Schema.String }) {}

const Rejection = Schema.Union([NotFound, BadRequest, Conflict, Forbidden, PreconditionFailed, TooManyRequests, Invalid]);
export const Profiles = RpcGroup.make(Rpc.make("Rename", { error: Rejection, payload: { name: Schema.String }, success: Schema.String }));
export const Handlers = Profiles.toLayer({
	Rename: ({ name }) => {
		if (name === "") {
			return Effect.fail(new BadRequest({ field: "name", message: "Name is required" }));
		}
		if (name === "malformed") {
			return Effect.fail(new BadRequest({ message: "Malformed" }));
		}
		if (name === "forbidden") {
			return Effect.fail(new Forbidden({ message: "No" }));
		}
		if (name === "invalid") {
			return Effect.fail(new Invalid({ field: "title", message: "Too long" }));
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
