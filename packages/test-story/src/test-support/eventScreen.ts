import { Deferred, Effect, Stream, SubscriptionRef } from "effect";
import { createElement } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/react.ts";
import { type ScreenTarget, screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { background } from "./attempt.ts";

expectNoReactWarnings();

export const eventScreen = storyKit({
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const pending = yield* SubscriptionRef.make(true);
		const observing = yield* Deferred.make<void>();
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(createElement("main", { key: 0 }, createElement("output", { "aria-label": "Loading" }, "Loading")))),
			(mounted) => Effect.promise(mounted.unmount),
		);
		const settings: { mode: "sampler" | "stream" | "none" } = { mode: "sampler" };
		return { ...settings, observing, page: 0, pending, subscriptions: 0, view };
	},
	inspect: ({ pending, view }) => ({ pending: SubscriptionRef.getUnsafe(pending), screen: view.container.innerHTML }),
	name: "screen events",
	stages: ["screen"],
	verbs: (engine, story) => {
		const { pending, observing, view } = engine;
		const stream = Stream.unwrap(
			Effect.acquireRelease(
				Effect.sync(() => {
					engine.subscriptions += 1;
					Effect.runSync(Deferred.succeed(observing, undefined));
					return SubscriptionRef.changes(pending);
				}),
				() =>
					Effect.sync(() => {
						engine.subscriptions -= 1;
					}),
			),
		);
		function sample() {
			Effect.runSync(Deferred.succeed(observing, undefined));
			return SubscriptionRef.getUnsafe(pending);
		}
		const signal = engine.mode === "stream" ? stream : sample;
		const driver = screenDriver({
			...(engine.mode === "none" ? {} : { pending: signal }),
			root: () => {
				const root = view.container.querySelector("main");
				if (!root) {
					throw new Error("The event screen has no main element");
				}
				return root;
			},
			tell: story.tell,
		});
		const waiting = background();
		function paint(message: string, complete = false, name = message) {
			story.tell(`render ${message}`);
			const output = createElement(
				"output",
				{
					"aria-label": name,
					ref: () => {
						if (complete) {
							Effect.runSync(SubscriptionRef.set(pending, false));
						}
					},
				},
				message,
			);
			return Effect.promise(() => view.render(createElement("main", { key: engine.page }, output)));
		}
		return {
			...driver,
			cancelSettling: () => waiting.cancel("settle"),
			complete: () => SubscriptionRef.set(pending, false),
			completeAndPaint: (message: string) => paint(message, true),
			finished: (operation: "settle" | "find") => waiting.finished(operation),
			paint,
			progress: (operation: "settle" | "find") => waiting.progress(operation, "waiting"),
			renameOutput: (name: string) => paint("Loading", false, name),
			replaceScreen: (message: string) =>
				Effect.sync(() => {
					engine.page += 1;
				}).pipe(Effect.andThen(paint(message))),
			startsFinding: (target: ScreenTarget) =>
				waiting
					.starts("find", driver.find(target), (element) => element.textContent ?? "")
					.pipe(Effect.andThen(engine.mode === "none" ? Effect.void : Deferred.await(observing))),
			startsSettling: () => waiting.starts("settle", driver.settle()).pipe(Effect.andThen(Deferred.await(observing))),
			subscriptionState: () => (engine.subscriptions === 0 ? "unsubscribed" : "subscribed"),
		};
	},
});

export const pendingStream = eventScreen.trait("screen", "the application supplies a pending stream", (engine) => {
	engine.mode = "stream";
});
export const noPending = eventScreen.trait("screen", "the application supplies no pending signal", (engine) => {
	engine.mode = "none";
});
export const idle = eventScreen.trait("screen", "the application is idle", ({ pending }) => SubscriptionRef.set(pending, false));
