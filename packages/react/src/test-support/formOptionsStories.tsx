import { Clock, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { FormOptionsView } from "./FormOptionsView.tsx";
import { type Kind, TitleCheck } from "./formOptionsModel.ts";
import type { Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	readonly calls: Map<string, PromiseWithResolvers<string | undefined>>;
	readonly started: PromiseWithResolvers<void>;
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
		reverse: () => screen.driver(current(state)).click({ name: "Reverse answers", role: "button" }),
		save: () => screen.driver(current(state)).click({ name: "Save", role: "button" }),
		type: (value: string) =>
			screen
				.driver(current(state))
				.enter('input[name="title"]', value)
				.pipe(Effect.andThen(Effect.promise(() => state.started.promise))),
	};
}
export const formOptions = storyKit(
	screenKit(
		"form options",
		(): State => ({ calls: new Map(), started: Promise.withResolvers<void>() }),
		(state, screen) => ({
			...verbs(state, screen),
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
			const checks = Layer.succeed(TitleCheck)({
				check: (value) =>
					Effect.promise(() => {
						const call = Promise.withResolvers<string | undefined>();
						state.calls.set(value, call);
						state.started.resolve();
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
