import { Config, Console, Effect, FileSystem, Schema } from "effect";
import { Argument, Flag } from "effect/cli";
import { defineScript } from "#defineScript.ts";

class RequestedFailure extends Schema.TaggedError<RequestedFailure>()("RequestedFailure", { message: Schema.String }) {}

defineScript({
	args: {
		count: Flag.Int("count").pipe(Flag.withDefault(1)),
		mode: Flag.Literals("mode", ["success", "failure", "wait"]).pipe(Flag.withDefault("success")),
		name: Argument.String("name"),
	},
	run: ({ count, mode, name }) =>
		Effect.gen(function* () {
			yield* Effect.acquireRelease(Console.log("resource acquired"), () => Console.log("resource released"));
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped();
			const greeting = yield* Config.String("SCRIPT_GREETING");
			const file = `${directory}/greeting.txt`;
			yield* fs.writeFileString(file, `${greeting} ${name}: ${count * 2}`);
			yield* Effect.logInfo(yield* fs.readFileString(file));
			if (mode === "failure") {
				return yield* new RequestedFailure({ message: "The requested work failed" });
			}
			if (mode === "wait") {
				yield* Console.log("waiting for interruption");
				yield* Effect.never;
			}
		}),
});
