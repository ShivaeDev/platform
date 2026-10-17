import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);
export const draftNames = formStories(
	() => Schema.Struct({ name: Schema.String }),
	() => ({
		initialValues: { name: "First" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const stock = formStories(
	() => Schema.Struct({ name: Schema.String, quantity: Schema.String }),
	() => ({
		initialValues: { name: "Printer paper", quantity: "300" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const optionalNotes = formStories(
	() => Schema.Struct({ name: Schema.String, note: Schema.optionalKey(Schema.String) }),
	() => ({
		initialValues: { name: "First" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const lines = formStories(
	() => Schema.Struct({ lines: Schema.Array(Schema.Struct({ id: Schema.String })), name: Schema.String }),
	() => ({
		initialValues: { lines: [{ id: "old" }], name: "First" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const payloads = formStories(
	() => Schema.Struct({ payload: Schema.Unknown }),
	() => ({
		initialValues: { payload: "First" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const cyclic: { self?: object } = {};
cyclic.self = cyclic;

export function untouchedLinesDraft() {
	return lines.traits(
		lines.withValues({ lines: [{ id: "fresh" }], name: "Remote" }),
		lines.withStoredDraft({ lines: [{ id: "old" }], name: "First" }, { lines: [{ id: "old" }], name: "Local" }),
	);
}
