import { Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { vi } from "vitest";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { FormOptionsView } from "./FormOptionsView.tsx";
import { type Kind, TitleCheck } from "./formOptionsModel.ts";
import { clickButton, type Screen, typeInput } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	readonly calls: Map<string, PromiseWithResolvers<string | undefined>>;
	view?: Rendered;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("The form options screen is not open");
	}
	return state.view.container;
}
function verbs(state: State, screen: Screen) {
	return {
		answerCheck: (value: string, message: string) =>
			screen.act(`answer the check for ${value}`, () => {
				const call = state.calls.get(value);
				if (!call) {
					throw new Error(`No check for ${value}`);
				}
				call.resolve(message);
			}),
		elapse: (millis: number) => screen.act(`advance the debounce clock by ${millis}ms`, () => vi.advanceTimersByTimeAsync(millis)),
		reverse: () => screen.act("reverse the answers", () => clickButton(current(state), "Reverse answers")),
		save: () => screen.act("save the form", () => clickButton(current(state), "Save")),
		type: (value: string) => screen.act(`type the title ${JSON.stringify(value)}`, () => typeInput(current(state), "title", value)),
	};
}
export const formOptions = storyKit(
	screenKit(
		"form options",
		(): State => ({ calls: new Map() }),
		(state, screen) => ({
			...verbs(state, screen),
			checked: () => Effect.sync(() => [...state.calls.keys()]),
			message: () => Effect.sync(() => current(state).querySelector("output")?.textContent),
			rows: () =>
				Effect.sync(() =>
					[...current(state).querySelectorAll("li")].map((row) => ({
						id: row.getAttribute("data-answer"),
						message: row.querySelector('[role="alert"]')?.textContent ?? "none",
					})),
				),
		}),
	),
);
export function optionsShown(kind: Kind) {
	return formOptions.trait(
		"screen",
		`a ${kind} form with custom required wording, keyed answers and held title checks`,
		function* ({ state, screen }) {
			yield* Effect.acquireRelease(
				Effect.sync(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })),
				() => Effect.sync(() => vi.useRealTimers()),
			);
			const runtime = Atom.runtime(
				Layer.succeed(TitleCheck)({
					check: (value) =>
						Effect.promise(() => {
							const call = Promise.withResolvers<string | undefined>();
							state.calls.set(value, call);
							return call.promise;
						}).pipe(Effect.uninterruptible),
				}),
			);
			state.view = yield* screen.open(<FormOptionsView kind={kind} runtime={runtime} />);
		},
	);
}
export function rejectedAnswers(kind: Kind) {
	return formOptions.trait("screen", `the ${kind} form was rejected with its second answer closed`, function* ({ state, screen }) {
		const driver = verbs(state, screen);
		yield* driver.type("closed");
		yield* driver.save();
	});
}
