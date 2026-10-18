import { type Cause, Effect, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { Conflict, InternalServerError, ServiceUnavailable } from "#errors/taxonomy.ts";
import { type RpcBoundaryOptions, rpcBoundary } from "#server/rpc-server/boundary.ts";

const Rejection = Schema.Union([Conflict, InternalServerError, ServiceUnavailable]);
const boundary = rpcBoundary(Rejection, { unexpected: (message) => new InternalServerError({ message }) });

export const boundaryStory = storyKit({
	create: () => ({ wrap: boundary }),
	name: "RPC boundary",
	stages: ["configured"],
	verbs: (state, story) => ({
		die: (defect: unknown) => {
			story.tell("the operation dies");
			return Effect.flip(state.wrap(Effect.die(defect)));
		},
		fail: (error: unknown) => {
			story.tell("the operation fails");
			return Effect.flip(state.wrap(Effect.fail(error)));
		},
		failCause: (cause: Cause.Cause<string>) => Effect.exit(state.wrap(Effect.failCause(cause))),
		interrupt: () => Effect.exit(state.wrap(Effect.interrupt)),
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
