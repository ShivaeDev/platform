import { Config, Context, Effect, Layer } from "effect";
import type { TestUserConfig } from "vitest/config";

export class TestOutput extends Context.Service<TestOutput, Pick<TestUserConfig, "silent">>()("@shivaedev/quality/TestOutput") {
	static readonly layer = Layer.effect(
		TestOutput,
		Effect.map(Config.String("CI").pipe(Config.withDefault("")), (ci) => ({ silent: ci ? false : "passed-only" })),
	);
}
