import { NodeRuntime } from "@effect/platform-node";
import { cruise } from "dependency-cruiser";
import { Console, Effect } from "effect";
import configuration from "../.dependency-cruiser.ts";

const program = Effect.gen(function* () {
	const result = yield* Effect.tryPromise(() =>
		cruise(["packages"], {
			...configuration.options,
			validate: true,
			ruleSet: configuration,
			outputType: "err",
		}),
	);
	yield* Console.log(result.output);
	process.exitCode = result.exitCode;
});

NodeRuntime.runMain(program);
