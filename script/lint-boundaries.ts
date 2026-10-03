import { NodeRuntime } from "@effect/platform-node";
import { cruise } from "dependency-cruiser";
import { Console, Effect } from "effect";
import configuration from "../.dependency-cruiser.ts";

const program = Effect.gen(function* () {
	const result = yield* Effect.tryPromise(() =>
		cruise(["packages"], {
			...configuration.options,
			outputType: "err",
			ruleSet: configuration,
			validate: true,
		}),
	);
	yield* Console.log(result.output);
	process.exitCode = result.exitCode;
});

NodeRuntime.runMain(program);
