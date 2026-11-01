import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { queryHeadersEngine, records } from "./queryHeadersEngine.ts";

export const queryHeadersStory = storyKit({
	clock: "live",
	*create() {
		const engine = yield* queryHeadersEngine;
		return { ...engine, views: [engine.api.hints.query()] };
	},
	inspect: ({ reads, subscriptions }) => ({ reads, subscriptions }),
	name: "automatic query request headers",
	stages: ["views"],
	verbs: (engine, story) => ({
		edit: (value: string) => {
			story.tell(`the record becomes ${value} and the server announces its change`);
			engine.stored.value = value;
			return engine.reactivity.invalidate(invalidationKeys([records.item(1)]));
		},
		reads: () =>
			Effect.sync(() =>
				[...new Set(engine.reads.filter(({ value }) => value === engine.stored.value).map(({ reader }) => reader))].sort((left, right) =>
					left.localeCompare(right),
				),
			),
		shown: () =>
			Effect.forEach(engine.views, (view) =>
				Effect.map(
					until(
						AtomRegistry.toStream(engine.registry, view),
						(result) => AsyncResult.isSuccess(result) && !result.waiting && result.value.endsWith(engine.stored.value),
						{ name: "current record value" },
					),
					(result) => (AsyncResult.isSuccess(result) ? result.value : "unavailable"),
				),
			),
		subscriptions: () => Effect.sync(() => [...engine.subscriptions].sort((left, right) => left.localeCompare(right))),
	}),
});

export function watching(delivery: "hints" | "pushed") {
	return queryHeadersStory.trait("views", `three ${delivery} queries read the same record with different headers`, (engine) => {
		engine.views = [
			engine.api[delivery].query(undefined, { headers: { "x-reader": "alice" } }),
			engine.api[delivery].query(undefined, { headers: [["x-reader", "bob"]] }),
			engine.api[delivery].query(),
		];
		for (const view of engine.views) {
			engine.registry.mount(view);
		}
	});
}
