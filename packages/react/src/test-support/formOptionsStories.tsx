import { Clock, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { TestClock } from "effect/testing";
import { vi } from "vitest";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { FormOptionsView } from "./FormOptionsView.tsx";
import { type Kind, TitleCheck } from "./formOptionsModel.ts";
import type { Screen } from "./Screen.ts";
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
		elapse: (millis: number) =>
			Effect.gen(function* () {
				const run = Effect.runPromiseWith(yield* Effect.context());
				yield* screen.act(`advance the debounce clock by ${millis}ms`, async () => {
					await run(TestClock.adjust(millis));
					await vi.advanceTimersByTimeAsync(millis);
				});
			}),
		reverse: () => screen.driver(current(state)).click({ name: "Reverse answers", role: "button" }),
		save: () => screen.driver(current(state)).click({ name: "Save", role: "button" }),
		type: (value: string) => screen.driver(current(state)).enter('input[name="title"]', value),
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
			const checks = Layer.succeed(TitleCheck)({
				check: (value) =>
					Effect.promise(() => {
						const call = Promise.withResolvers<string | undefined>();
						state.calls.set(value, call);
						return call.promise;
					}).pipe(Effect.uninterruptible),
			});
			const runtime = Atom.runtime(Layer.merge(Layer.succeed(Clock.Clock, yield* Clock.Clock), checks));
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
