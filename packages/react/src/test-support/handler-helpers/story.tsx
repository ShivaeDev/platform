import { Clock, Effect, Layer } from "effect";
import { SecureRandom } from "effect/crypto";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { TestClock } from "effect/testing";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { screenPending } from "#adapters/screenPending.ts";
import { Digest } from "#test/handler-helpers/Digest.tsx";
import { View } from "#test/handler-helpers/View.tsx";
import { Screen } from "#test/Screen.ts";

export const handlers = storyKit({
	after: {
		screen: (engine) => engine.screen.act("the controls render", () => engine.view.render(engine.component())),
	},
	clock: "test",
	*create() {
		yield* TestClock.setTime(123_000);
		const clock = yield* Clock.Clock;
		const random = yield* SecureRandom.SecureRandom;
		const state = {
			browser: false,
			mapFailure: true,
			promise: Promise.withResolvers<string>(),
			text: "first clipboard text",
			throws: false,
		};
		const runtime = Atom.runtime(Layer.merge(Layer.succeed(Clock.Clock, clock), Layer.succeed(SecureRandom.SecureRandom, random)));
		const screen = new Screen(() => undefined);
		function call(text: string) {
			if (state.throws) {
				throw new Error("Clipboard unavailable");
			}
			return state.promise.promise.then(() => text);
		}
		function component() {
			return (
				<>
					<View call={call} mapFailure={state.mapFailure} runtime={state.browser ? undefined : runtime} text={state.text} />
					{state.browser && <Digest />}
				</>
			);
		}
		const view = yield* screen.open();
		const pending = yield* screenPending().pipe(Effect.provideService(AtomRegistry.AtomRegistry, view.registry));
		return { component, pending, run: Effect.runPromiseWith(yield* Effect.context()), screen, state, view };
	},
	inspect: ({ view }) => ({ screen: view.container.textContent }),
	name: "React handler helpers",
	stages: ["screen"],
	verbs: ({ component, pending, run, screen, state, view }, story) => {
		screen.tell = story.tell;
		const driver = screenDriver({ act, pending, root: view.container, tell: story.tell });
		return {
			click: (name: string) => driver.click({ name, role: "button" }),
			passes: (millis: number) => screen.act(`${millis} milliseconds pass`, () => run(TestClock.adjust(millis))),
			reject: (reason: string) => screen.act(`the promise rejects with ${reason}`, () => state.promise.reject(reason)),
			rerender: (text: string) =>
				screen.act(`the clipboard text becomes ${text}`, () => {
					state.text = text;
					return view.render(component());
				}),
			resolve: () => screen.act("the promise resolves", () => state.promise.resolve("copied")),
			settle: () => driver.settle(),
			shown: (field: string) => Effect.sync(() => view.container.querySelector(`[data-${field}]`)?.textContent),
		};
	},
});

export const browserServices = handlers.trait("screen", "the default browser services are used", ({ state }) => {
	state.browser = true;
});
export const defaultFailure = handlers.trait("screen", "promise failures use the default error type", ({ state }) => {
	state.mapFailure = false;
});
export const synchronousThrow = handlers.trait("screen", "the clipboard call throws before returning a promise", ({ state }) => {
	state.throws = true;
});
