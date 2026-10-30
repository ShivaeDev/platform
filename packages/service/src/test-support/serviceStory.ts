import { Deferred, Effect, Layer, Scope } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { builtCounter, serviceEngine, serviceLayer } from "./serviceEngine.ts";
import { serviceVerbs } from "./serviceVerbs.ts";

export const serviceStory = storyKit({
	create: serviceEngine,
	inspect: ({ answers, initialization, initializerRuns, methodBuilds, released }) => ({
		answers,
		initialization,
		initializerRuns,
		methodBuilds,
		released,
	}),
	name: "defined service",
	stages: ["initializer", "layer", "call"],
	verbs: (engine, story) => serviceVerbs(engine, story.tell),
});

export function initializationFails() {
	return serviceStory.trait("initializer", "the initializer acquires its resource and then fails with initialization failure", (engine) => {
		engine.initialization = "fails after acquiring its resource";
	});
}

export function serviceBuilt({ greeting = "hello" }: { readonly greeting?: string } = {}) {
	return serviceStory.trait("layer", `the service's Layer is built in its own scope with the greeting "${greeting}"`, function* (engine) {
		engine.built = yield* Layer.buildWithScope(serviceLayer(engine, greeting), engine.layerScope);
	});
}

export function buildWaitsInInitializer() {
	return serviceStory.trait(
		"layer",
		"the service's Layer is being built, and its initializer waits after acquiring its resource",
		function* (engine) {
			engine.initialization = "waits after acquiring its resource";
			engine.build = yield* Effect.forkScoped(Layer.build(serviceLayer(engine, "hello")).pipe(Effect.scoped));
			yield* Deferred.await(engine.initializerAcquired);
		},
	);
}

export function ownerHoldsService() {
	return serviceStory.trait("layer", "the owner provides the service's Layer to a program that holds the service", function* (engine) {
		const holding = yield* Deferred.make<void>();
		const program = Effect.service(engine.counter).pipe(Effect.andThen(Deferred.succeed(holding, undefined)), Effect.andThen(Effect.never));
		engine.owner = yield* Effect.forkScoped(Effect.provide(program, serviceLayer(engine, "hello")));
		yield* Deferred.await(holding);
	});
}

export function callHoldsResource() {
	return serviceStory.trait("call", "the caller's call acquires the call's resource in the caller's scope and keeps running", function* (engine) {
		const service = yield* builtCounter(engine);
		engine.call = yield* Effect.forkScoped(Effect.scoped(service.hold()));
		yield* Deferred.await(engine.resourceHeld);
	});
}

export function callOpensResource() {
	return serviceStory.trait("call", "the caller's call opens the call's resource in a scope the caller keeps open", function* (engine) {
		const service = yield* builtCounter(engine);
		const callerScope = yield* Scope.fork(yield* Effect.scope);
		engine.callerScope = callerScope;
		yield* service.open().pipe(Scope.provide(callerScope));
	});
}
