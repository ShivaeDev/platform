import { Effect } from "effect";

const DOM = Symbol.for("test-story.dom");

export function inDom() {
	return typeof Reflect.get(globalThis, DOM) === "function";
}

// The DOM environment keeps one window per file, so each story clears what an earlier story stored in it.
export const freshDocument = Effect.sync(() => {
	const clear: unknown = Reflect.get(globalThis, DOM);
	if (typeof clear === "function") {
		clear();
	}
});
