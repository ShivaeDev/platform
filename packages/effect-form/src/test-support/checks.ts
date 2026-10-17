import { Context, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);
const Names = Schema.Struct({ name: Schema.String });
export const takenCheck = formStories(
	() => Names,
	() => ({
		checks: { name: (value) => Effect.succeed(value === "taken" ? "Name is taken" : undefined) },
		debounce: "5 millis",
		initialValues: { name: "" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const brokenCheck = formStories(
	() => Names,
	() => ({
		checks: {
			name: (value) => (value === "broken" ? Effect.die("check unavailable") : Effect.succeed(value === "taken" ? "Name is taken" : undefined)),
		},
		debounce: "5 millis",
		initialValues: { name: "" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const delayedCheck = formStories(
	() => Names,
	({ checkGate }) => ({
		checks: { name: checkGate.check },
		debounce: "5 millis",
		initialValues: { name: "" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
class Reserved extends Context.Service<Reserved, ReadonlySet<string>>()("test/Reserved") {}
export const reservedCheck = formStories(
	() => Names,
	() => ({
		checks: { name: (value) => Effect.map(Reserved, (reserved) => (reserved.has(value) ? "Name is reserved" : undefined)) },
		debounce: "5 millis",
		initialValues: { name: "" },
		onSubmit: Effect.succeed,
		runtime: Atom.runtime(Layer.succeed(Reserved)(new Set(["admin"]))),
	}),
);
export const validatedCheck = formStories(
	() => Schema.Struct({ name: Schema.String }),
	({ checked }) => ({
		checks: {
			name: (value) =>
				Effect.sync(() => {
					checked.push(value);
					return undefined;
				}),
		},
		debounce: "5 millis",
		initialValues: { name: "" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);

export function minimumName() {
	return validatedCheck.withSchema(Schema.Struct({ name: Schema.String.check(Schema.isMinLength(3)) }));
}
