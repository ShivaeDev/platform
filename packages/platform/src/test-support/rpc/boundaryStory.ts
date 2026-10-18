import { Effect, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { Conflict, InternalServerError, ServiceUnavailable } from "#errors/taxonomy.ts";
import { type RpcBoundaryOptions, rpcBoundary } from "#rpc-server/boundary.ts";

const Rejection = Schema.Union([Conflict, InternalServerError, ServiceUnavailable]);
const boundary = rpcBoundary(Rejection, { unexpected: (message) => new InternalServerError({ message }) });

export const boundaryStory = storyKit({
	create: () => ({ wrap: boundary }),
	name: "RPC boundary",
	stages: ["configured"],
	verbs: (state, story) => ({
		fail: (error: unknown, defect = false) => {
			story.tell(`the operation ${defect ? "dies" : "fails"}`);
			return Effect.flip(state.wrap(defect ? Effect.die(error) : Effect.fail(error)));
		},
		failCause: (cause: import("effect").Cause.Cause<string>) => Effect.exit(state.wrap(Effect.failCause(cause))),
		interrupt: () => Effect.exit(state.wrap(Effect.interrupt)),
		reject: (error: Conflict) => Effect.flip(state.wrap(Effect.fail(error))),
		succeed: (value: string) => {
			story.tell("the operation succeeds");
			return state.wrap(Effect.succeed(value));
		},
	}),
});
export function boundaryPolicy(schema: Schema.ConstraintDecoder<typeof Rejection.Type>, options: RpcBoundaryOptions<typeof Rejection.Type>) {
	return boundaryStory.trait("configured", "the application configures declared rejections and the public fallback", (state) => {
		state.wrap = rpcBoundary(schema, options);
	});
}
