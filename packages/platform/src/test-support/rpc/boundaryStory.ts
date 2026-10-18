import { Effect, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { Conflict, InternalServerError, ServiceUnavailable } from "#errors/taxonomy.ts";
import { rpcBoundary } from "#rpc-server/boundary.ts";

const Rejection = Schema.Union([Conflict, InternalServerError, ServiceUnavailable]);
const boundary = rpcBoundary(Rejection, { unexpected: (message) => new InternalServerError({ message }) });

export const boundaryStory = storyKit({
	create: () => boundary,
	name: "RPC boundary",
	stages: ["configured"],
	verbs: (wrap, story) => ({
		fail: (error: unknown, defect = false) => {
			story.tell(`the operation ${defect ? "dies" : "fails"}`);
			return Effect.flip(wrap(defect ? Effect.die(error) : Effect.fail(error)));
		},
		failCause: (cause: import("effect").Cause.Cause<string>) => Effect.exit(wrap(Effect.failCause(cause))),
		interrupt: () => Effect.exit(wrap(Effect.interrupt)),
		reject: (error: Conflict) => Effect.flip(wrap(Effect.fail(error))),
		succeed: (value: string) => {
			story.tell("the operation succeeds");
			return wrap(Effect.succeed(value));
		},
		unavailable: () =>
			Effect.flip(
				rpcBoundary(ServiceUnavailable, {
					message: "Upstream failed with token=private-value",
					unexpected: (message) => new ServiceUnavailable({ message }),
				})(Effect.fail("private failure")),
			),
	}),
});
