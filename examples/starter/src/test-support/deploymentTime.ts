import process from "node:process";
import { createInterface } from "node:readline";
import { Effect, Schema, Stream } from "effect";
import type { hostTime } from "@shivaedev/server/testing/hostTime.ts";

const PassTime = Schema.fromJsonString(Schema.Struct({ milliseconds: Schema.Number, poll: Schema.Boolean }));

export const deploymentTime = Effect.fn("DeploymentStory.deploymentTime")(function* (time: Effect.Success<ReturnType<typeof hostTime>>) {
	const lines = yield* Effect.acquireRelease(
		Effect.sync(() => createInterface({ input: process.stdin })),
		(input) => Effect.sync(() => input.close()),
	);
	yield* Stream.fromAsyncIterable(lines, (cause) => cause).pipe(
		Stream.mapEffect((line) => Schema.decodeUnknownEffect(PassTime)(line)),
		Stream.runForEach(({ milliseconds, poll }) => time.timePasses(milliseconds, { poll }).pipe(Effect.andThen(Effect.logInfo("Story time passed")))),
		Effect.forkScoped,
	);
});
