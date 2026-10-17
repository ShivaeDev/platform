import { Context, Effect, Layer } from "effect";

export class RuntimeValue extends Context.Service<RuntimeValue, string>()("@test/PlatformRuntimeValue") {}
export class RuntimeOther extends Context.Service<RuntimeOther, string>()("@test/PlatformRuntimeOther") {}

export function runtimeLayer() {
	const lifecycle = { acquisitions: 0, releases: 0 };
	const layer = Layer.merge(
		Layer.effect(
			RuntimeValue,
			Effect.acquireRelease(
				Effect.sync(() => {
					lifecycle.acquisitions += 1;
					return "base";
				}),
				() =>
					Effect.sync(() => {
						lifecycle.releases += 1;
					}),
			),
		),
		Layer.succeed(RuntimeOther, "base-other"),
	);
	return { layer, lifecycle };
}
