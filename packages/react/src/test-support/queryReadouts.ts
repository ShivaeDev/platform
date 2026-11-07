import { Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { native, type State, view } from "#test/queryState.ts";

function text(state: State, selector: string) {
	return view(state).container.querySelector(selector)?.textContent ?? "none";
}

function marked(state: State, key: "content" | "shell", selector: string) {
	const current = view(state).container.querySelector(selector);
	if (current === null) {
		return "missing";
	}
	return current === state.marked?.[key] ? "original" : "replaced";
}

export function queryReadouts(state: State) {
	return {
		alert: () => Effect.sync(() => text(state, '[role="alert"]')),
		crash: () => Effect.sync(() => text(state, "[data-crash]")),
		elements: () => Effect.sync(() => ({ content: marked(state, "content", "article"), shell: marked(state, "shell", '[name="shell"]') })),
		field: (name: string) => Effect.sync(() => view(state).container.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? "missing"),
		loading: () => Effect.sync(() => text(state, '[role="status"]')),
		nativeAnswer: () => Effect.sync(() => Option.getOrElse(AsyncResult.value(view(state).registry.get(native(state))), () => "none")),
		shown: () => Effect.sync(() => view(state).shown()),
		shownAnswer: () => Effect.sync(() => text(state, "output")),
	};
}
