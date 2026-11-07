import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { loaderHost } from "#test/loaderHost.ts";
import type { Engine } from "#test/loaderScreenState.ts";
import { loaderVerbs } from "#test/loaderVerbs.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

export const loaderScreen = storyKit({
	clock: "test",
	*create() {
		const host = yield* loaderHost();
		const engine: Engine = {
			host,
			loaded: Promise.withResolvers<void>(),
			mount: Promise.withResolvers<void>(),
			mountGate: { wait: () => Promise.resolve() },
			renders: [],
		};
		return engine;
	},
	inspect: (engine) => ({ calls: engine.host.calls, renders: engine.renders, screen: engine.view?.container.textContent }),
	name: "loader handoff screen",
	stages: ["screen"],
	verbs: loaderVerbs,
});
