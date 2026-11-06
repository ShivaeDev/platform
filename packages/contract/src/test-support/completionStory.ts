import { Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { querySignals } from "#querySignals.ts";
import { shown } from "./answers.ts";
import { completionEngine, records } from "./completionEngine.ts";
import { type Mark, markQuery, reRead } from "./reRead.ts";
import { settled } from "./settled.ts";

export const completionStory = storyKit({
	clock: "test",
	*create() {
		const marked: { mark: Mark | undefined } = { mark: undefined };
		return { ...(yield* completionEngine), ...marked };
	},
	inspect: ({ registry, state, view }) => ({ ...state, signals: registry.get(querySignals(view)) }),
	name: "query completion over a real socket",
	stages: ["access", "view"],
	verbs: (engine, story) => ({
		announce: (value: string) => {
			story.tell(`the server announces the record with value ${value}`);
			engine.mark = markQuery(engine.registry, engine.view);
			engine.state.value = value;
			return engine.reactivity.invalidate(invalidationKeys([records.item(1)]));
		},
		failRefresh: () => {
			story.tell("the server fails the announced read");
			engine.mark = markQuery(engine.registry, engine.view);
			engine.state.failed = true;
			return engine.reactivity.invalidate(invalidationKeys([records.item(1)]));
		},
		open: (mode: "ordinary" | "pushed") => {
			story.tell(`the client opens a ${mode} query`);
			engine.view = mode === "ordinary" ? engine.ordinary.pushed.query() : engine.api[mode].query();
			engine.registry.mount(engine.view);
		},
		refreshed: () => reRead(engine.registry, engine.view, engine.mark),
		releaseAnswer: () => {
			story.tell("the server releases its held answer");
			return Deferred.succeed(engine.answer, undefined);
		},
		requestFinished: () => settled(engine.registry, engine.view),
		requestReceived: () => Deferred.await(engine.received),
		shown: () => Effect.sync(() => shown(engine.registry.get(engine.view), (value) => value)),
		signals: () => Effect.sync(() => engine.registry.get(querySignals(engine.view))),
		subscriptionAnswered: () =>
			until(
				AtomRegistry.toStream(engine.registry, querySignals(engine.view)),
				({ subscription }) => subscription === "open" || subscription === "refused",
				{ name: "answered subscription" },
			),
	}),
});

export const refused = completionStory.trait("access", "the record's read policy refuses the subscription", ({ state }) => {
	state.allowed = false;
});
export const failed = completionStory.trait("access", "the query handler fails with ReadFailed", ({ state }) => {
	state.failed = true;
});

export function watching(delivery: "pushed") {
	return completionStory.trait("view", `the client watches the ${delivery} query`, function* (engine) {
		engine.view = engine.api[delivery].query();
		engine.registry.mount(engine.view);
		yield* settled(engine.registry, engine.view);
	});
}

export const held = completionStory.trait("access", "the server holds its answer", ({ state }) => {
	state.held = true;
});
