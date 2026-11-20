import { Effect, Layer, Schema } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command } from "@shivaedev/contract/operation.ts";
import { MaybeAuthenticated } from "@shivaedev/identity/middleware.ts";
import type { AppModule } from "#AppModule.ts";

const Greet = command("greet", {
	invalidates: () => [],
	payload: { name: Schema.String },
	*run({ name }) {
		return yield* Effect.succeed(`Hello, ${name}`);
	},
});

export const Greetings = defineModule({
	middleware: MaybeAuthenticated,
	name: "greetings",
	operations: [Greet],
	requires: [],
	wire: { greet: { rejections: {}, success: Schema.String } },
});

// Needs no table and gives no name, so the host must take the name from the module and serve it without a loader.
export const greetingsModule = { module: Greetings, services: Layer.empty } satisfies AppModule;
