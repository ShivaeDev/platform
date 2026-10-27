import { Context, Effect, Layer } from "effect";

export class RuntimeValue extends Context.Service<RuntimeValue, string>()("@test/PlatformRuntimeValue") {}
export class RuntimeOther extends Context.Service<RuntimeOther, string>()("@test/PlatformRuntimeOther") {}

export function runtimeLayer(lifecycle: string[]) {
	return Layer.merge(
		Layer.effect(
			RuntimeValue,
			Effect.acquireRelease(
				Effect.sync(() => {
					lifecycle.push("acquired");
					return "base";
				}),
				() =>
					Effect.sync(() => {
						lifecycle.push("disposed");
					}),
			),
		),
		Layer.succeed(RuntimeOther, "base-other"),
	);
}
