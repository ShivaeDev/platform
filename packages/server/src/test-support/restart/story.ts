import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { openTab } from "./openTab.ts";
import { startHost } from "./startHost.ts";

export const restartStory = storyKit({
	clock: "test",
	*create() {
		const host = yield* startHost();
		const tabs = yield* Effect.forEach(
			Array.from({ length: 12 }, (_, index) => `tab ${index + 1}`),
			(tab) => openTab(host.port, tab),
		);
		yield* Effect.forEach(tabs, (tab) => tab.results(host.pid), { concurrency: "unbounded" });
		return { host, tabs };
	},
	name: "live tabs across a host restart",
	stages: [],
	verbs: (state, story) => {
		const currentReads = Effect.forEach(state.tabs, (tab) => tab.results(state.host.pid), { concurrency: "unbounded" });
		return {
			queriesAnsweredByCurrentHost: () =>
				Effect.map(currentReads, (tabs) => Object.fromEntries(tabs.map((results) => [results[0]?.tab ?? "no tab", results.map(({ id }) => id)]))),
			rerunSpread: () =>
				Effect.map(currentReads, (tabs) => {
					const firstReads = tabs.map((results) => Math.min(...results.map(({ readAt }) => readAt)));
					const spread = Math.max(...firstReads) - Math.min(...firstReads);
					return spread > 50 ? "spread over more than 50 ms" : `bunched within ${spread} ms`;
				}),
			restart: () =>
				Effect.gen(function* () {
					story.tell(
						"a replacement process loads, then the host is killed and the replacement listens on the same port with every query still mounted",
					);
					const port = state.host.port;
					state.host = yield* startHost(port, state.host.stop());
				}),
		};
	},
});
