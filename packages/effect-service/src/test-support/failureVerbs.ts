import { Context, Effect, Layer } from "effect";
import type { failureEngine } from "./serviceEngine.ts";

export function failureVerbs(engine: ReturnType<typeof failureEngine>, tell: (line: string) => void) {
	return {
		buildFailedInitialization: () => {
			tell("the caller builds the service whose initializer fails");
			return Effect.scoped(Layer.build(engine.failedInitialization.layer)).pipe(Effect.flip);
		},
		buildFailedMethod: () =>
			Effect.gen(function* () {
				tell("the caller builds the service with a fallible method");
				const context = yield* Layer.build(engine.methodLayer);
				return Context.get(context, engine.failedMethod);
			}),
		crash: () => {
			tell("the caller invokes the defective method");
			return engine.defectiveMethod.pipe(
				Effect.flatMap((service) => Effect.exit(service.crash())),
				Effect.provide(engine.defectiveMethod.layer),
			);
		},
		run: (service: Context.Service.Shape<ReturnType<typeof failureEngine>["failedMethod"]>, fail: boolean) => {
			tell(fail ? "the caller invokes the failing method" : "the caller invokes the method successfully");
			return service.run(fail);
		},
	};
}
