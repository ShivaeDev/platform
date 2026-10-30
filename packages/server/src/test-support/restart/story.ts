import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { openTab } from "./openTab.ts";
import { startHost } from "./startHost.ts";

export const restartStory = storyKit({
	clock: "live",
	*create() {
		const host = yield* startHost();
		const tabs = yield* Effect.forEach(
			Array.from({ length: 12 }, (_, index) => `tab ${index + 1}`),
			(tab) => openTab(host.port, tab),
		);
		return { host, tabs };
	},
	name: "live tabs across a host restart",
	stages: [],
	verbs: (state, story) => ({
		processId: () => state.host.pid,
		restart: () =>
			Effect.gen(function* () {
				story.tell("the host process is killed and a new process starts on the same port while every query remains mounted");
				const port = state.host.port;
				yield* Effect.promise(state.host.stop);
				state.host = yield* startHost(port);
			}),
		results: () => Effect.forEach(state.tabs, (tab) => tab.results(state.host.pid), { concurrency: "unbounded" }),
	}),
});
