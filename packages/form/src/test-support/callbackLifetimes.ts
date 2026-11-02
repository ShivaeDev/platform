import { Context, Deferred, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

class SaveConnection extends Context.Service<SaveConnection, string>()("form/test/SaveConnection") {}

interface Resources {
	readonly active: Set<string>;
	readonly connectionReleased: Deferred.Deferred<void>;
	readonly interrupted: string[];
	readonly saveReleased: Deferred.Deferred<void>;
	readonly saveStarted: Deferred.Deferred<void>;
}

function resource(resources: Resources, name: string, released: Deferred.Deferred<void>) {
	return Effect.acquireRelease(
		Effect.sync(() => {
			resources.active.add(name);
			return name;
		}),
		() => Effect.sync(() => resources.active.delete(name)).pipe(Effect.andThen(Deferred.succeed(released, undefined))),
	);
}

export const callbackLifetimes = formStories(() => Schema.Struct({ name: Schema.String }), {
	config: (resources) => ({
		initialValues: { name: "First" },
		onSubmit: (values) =>
			Effect.gen(function* () {
				yield* SaveConnection;
				if (values.name !== "First") {
					return values;
				}
				yield* resource(resources, "save:First", resources.saveReleased);
				yield* Deferred.succeed(resources.saveStarted, undefined);
				return yield* Effect.never;
			}).pipe(Effect.onInterrupt(() => Effect.sync(() => resources.interrupted.push(values.name)))),
		runtime: Atom.runtime(Layer.effect(SaveConnection, resource(resources, "connection", resources.connectionReleased))),
	}),
	support: (): Resources => ({
		active: new Set(),
		connectionReleased: Deferred.makeUnsafe(),
		interrupted: [],
		saveReleased: Deferred.makeUnsafe(),
		saveStarted: Deferred.makeUnsafe(),
	}),
	verbs: (driver, tell, resources) => ({
		activeResources: () => Effect.sync(() => [...resources.active]),
		disposeRegistry: () => {
			tell("dispose the form's registry");
			return Effect.sync(() => driver.engine.registry.dispose()).pipe(
				Effect.andThen(Deferred.await(resources.saveReleased)),
				Effect.andThen(Deferred.await(resources.connectionReleased)),
			);
		},
		interruptedSaves: () => Deferred.await(resources.saveReleased).pipe(Effect.andThen(Effect.sync(() => [...resources.interrupted]))),
	}),
});

export function firstSaveInFlight() {
	return callbackLifetimes.step("the first save has acquired its resource and waits for an answer", (driver, engine) => {
		driver.engine.registry.set(driver.current().submit, undefined);
		return Deferred.await(engine.support.saveStarted);
	});
}
