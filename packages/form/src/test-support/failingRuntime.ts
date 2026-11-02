import { Context, Data, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

class SaveConnection extends Context.Service<SaveConnection, string>()("form/test/FailingSaveConnection") {}
class ConnectionUnavailable extends Data.TaggedError("ConnectionUnavailable")<{ readonly message: string }> {}

export const failingRuntime = formStories(() => Schema.Struct({ name: Schema.String }), {
	config: () => ({
		initialValues: { name: "First" },
		onSubmit: (values) => Effect.as(SaveConnection, values),
		runtime: Atom.runtime(Layer.effect(SaveConnection, Effect.fail(new ConnectionUnavailable({ message: "Save connection is unavailable" })))),
	}),
	support: () => undefined,
	verbs: (driver) => ({
		connectionFailure: () =>
			driver.result().pipe(
				Effect.as("saved"),
				Effect.catchTag("ConnectionUnavailable", (error) => Effect.succeed(error.message)),
			),
	}),
});
