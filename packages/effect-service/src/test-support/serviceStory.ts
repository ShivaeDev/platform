import { Effect, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { Declared, genericService, requiredService, scopedService, serviceEngine } from "./serviceEngine.ts";
import { serviceVerbs } from "./serviceVerbs.ts";

export const serviceStory = storyKit({
	create: serviceEngine,
	inspect: ({ counts, declaration }) => ({ ...counts, declaration: declaration.kind }),
	name: "defined service",
	stages: ["declaration"],
	verbs: (engine, story) => serviceVerbs(engine, story.tell),
});

export function declaresScopedService() {
	return serviceStory.trait("declaration", "the service declares scoped initialization and caller resources", function* (engine) {
		const Service = scopedService(engine.counts);
		const context = yield* Layer.buildWithScope(Service.layer, engine.scope);
		engine.declaration = { kind: "scoped", read: Effect.provide(Service, context) };
	});
}

export function declaresRequirement(prefix = "declared") {
	return serviceStory.trait("declaration", `the service declares a requirement with prefix ${prefix}`, function* (engine) {
		const Service = requiredService();
		const layer = Service.layer.pipe(Layer.provide(Layer.succeed(Declared, { identity: {}, prefix })));
		const context = yield* Layer.buildWithScope(layer, engine.scope);
		engine.declaration = { kind: "required", read: Effect.provide(Service, context) };
	});
}

export function declaresGenericMethod() {
	return serviceStory.trait("declaration", "the requirement-free service declares a generic method", function* (engine) {
		const Service = genericService();
		const context = yield* Layer.buildWithScope(Service.layer, engine.scope);
		engine.declaration = { kind: "generic", read: Effect.provide(Service, context) };
	});
}
