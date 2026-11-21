import { Effect, Layer } from "effect";
import { Store } from "@shivaedev/rate-limit/Store.ts";
import { app } from "#modules/notes/test-support/application.ts";

export const recordingStore = app.trait(
	"hosting",
	"a replacement Layer supplies one rate-limit store that records each budget spent in it",
	(engine) => {
		const store = Layer.succeed(Store, {
			consume: ({ key }) =>
				Effect.sync(() => {
					engine.spentBudgets.push(key);
				}),
		});
		engine.hostOptions = { ...engine.hostOptions, replacements: Layer.merge(engine.hostOptions.replacements ?? Layer.empty, store) };
	},
);
