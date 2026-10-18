import { Deferred, Effect, type Exit } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { createElement } from "react";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { resultEngine } from "./resultEngine.ts";
import { QueryValue, ResultView } from "./resultViews.tsx";
import { screenKit } from "./screenKit.ts";

interface State {
	engine: ReturnType<typeof resultEngine>;
	root?: Rendered;
}
function root(state: State) {
	if (!state.root) {
		throw new Error("No result screen");
	}
	return state.root;
}
export const resultHooks = storyKit(
	screenKit(
		"result hook screen",
		(): State => ({ engine: resultEngine() }),
		(state, screen) => ({
			changeIdentity: () =>
				screen.act("switch from account A to a pending query", () =>
					root(state).render(createElement(QueryValue, { atom: Atom.make(Effect.never) })),
				),
			engine: () => state.engine,
			execute: () =>
				screen.act("click the query or action", () => {
					const button = root(state).container.querySelector("button");
					if (!button) {
						throw new Error("Missing result hook execute button");
					}
					button.click();
				}),
			finish: (result: Exit.Exit<number, string>, which: "gate" | "first" | "second" = "gate") =>
				screen.act(`complete ${which}: ${JSON.stringify(result)}`, () => Effect.runSync(Deferred.done(state.engine[which], result))),
			next: () => {
				screen.tell("the next request waits for a new response");
				state.engine.gate = Effect.runSync(Deferred.make<number, string>());
			},
			snapshot: () => JSON.parse(root(state).container.textContent ?? "null"),
			text: () => root(state).container.textContent,
		}),
	),
);
export function resultHook(mode: "query" | "action" | "overlap" | "shared" | "identity") {
	return resultHooks.trait("screen", `a rendered ${mode} hook`, function* ({ screen, state }) {
		state.root = yield* screen.open(
			mode === "identity"
				? createElement(QueryValue, { atom: Atom.make(Effect.succeed("account A")) })
				: createElement(ResultView, { engine: state.engine, mode }),
		);
	});
}
