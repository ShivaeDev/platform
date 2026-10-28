import { Effect, Schema, Struct } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { BadRequest, Conflict, Forbidden, NotFound, PreconditionFailed, TooManyRequests } from "@shivaedev/errors/taxonomy.ts";

export class Invalid extends Schema.TaggedError<Invalid>()("Invalid", { field: Schema.Literals(["title"]), message: Schema.String }) {}

export const renameRejections = {
	"a bad request on a field": () => new BadRequest({ field: "name", message: "Name is required" }),
	"a bad request on the whole form": () => new BadRequest({ message: "Malformed" }),
	"a conflict on a field": () => new Conflict({ field: "name", message: "Name is taken" }),
	"a failed precondition": () => new PreconditionFailed({ message: "Profile changed" }),
	"a forbidden change": () => new Forbidden({ message: "No" }),
	"a missing profile": () => new NotFound({ message: "No profile" }),
	"an app-defined field error": () => new Invalid({ field: "title", message: "Too long" }),
	"too many requests": () => new TooManyRequests({ message: "Slow down" }),
} as const;

export type RenameRejection = keyof typeof renameRejections;

const Rejection = Schema.Union([NotFound, BadRequest, Conflict, Forbidden, PreconditionFailed, TooManyRequests, Invalid]);
export const Profiles = RpcGroup.make(
	Rpc.make("Rename", {
		error: Rejection,
		payload: { rejectWith: Schema.Literals(Struct.keys(renameRejections)) },
		success: Schema.String,
	}),
);
export const Handlers = Profiles.toLayer({
	Rename: ({ rejectWith }) => Effect.fail(renameRejections[rejectWith]()),
});
