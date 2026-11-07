import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { streams } from "#test/answers.ts";
import { queryHeadersEngine } from "#test/queryHeadersEngine.ts";
import { syntheticNative, syntheticWindow } from "#test/resumeSources.ts";
import { settled } from "#test/settled.ts";

export const clientResumeStory = storyKit({
	clock: "test",
	*create() {
		const native = syntheticNative();
		const browser = syntheticWindow();
		const engine = yield* queryHeadersEngine({ resume: native.source, resumeWindow: browser.window });
		const views = [
			engine.api.pushed.query(undefined, { headers: { "x-slot": "first" } }),
			engine.api.pushed.query(undefined, { headers: { "x-slot": "second" } }),
		];
		return { ...engine, browser, native, views };
	},
	inspect: ({ reads, subscriptions }) => ({ reads, subscriptions }),
	name: "client resume options",
	stages: ["views"],
	verbs: (engine, story) => ({
		changeQuietly: (value: string) => {
			story.tell(`the record becomes ${value} without a change hint`);
			engine.stored.value = value;
		},
		dispose: () => {
			story.tell("the client disposes its registry");
			engine.registry.dispose();
		},
		listeners: () => Effect.sync(() => ({ browser: engine.browser.listeners.size, native: engine.native.listeners.size })),
		resume: (source: "native" | "online" | "visibilitychange") => {
			story.tell(`the ${source} resume source signals the client`);
			if (source === "native") {
				engine.native.resume();
			} else {
				engine.browser.fire(source);
			}
		},
		shown: () =>
			Effect.forEach(engine.views, (view) =>
				Effect.map(settled(engine.registry, view), (result) => (AsyncResult.isSuccess(result) ? result.value : "unavailable")),
			),
		subscriptionsOpened: () => streams(engine.subscriptions.length, "opened"),
		untilRefreshed: () =>
			Effect.forEach(engine.views, (view) =>
				until(
					AtomRegistry.toStream(engine.registry, view),
					(result) => AsyncResult.isSuccess(result) && !result.waiting && result.value.endsWith(engine.stored.value),
					{ name: "resumed query value" },
				),
			),
	}),
});

export const watching = clientResumeStory.trait("views", "the client watches two pushed queries", function* (engine) {
	for (const view of engine.views) {
		engine.registry.mount(view);
		yield* settled(engine.registry, view);
	}
});
