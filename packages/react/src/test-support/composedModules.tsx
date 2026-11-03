import { type Duration, Effect } from "effect";
import { composeBindings } from "@shivaedev/contract/composeBindings.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { ComposedModuleScreen } from "./ComposedModuleScreen.tsx";
import { composedModule } from "./composedModule.ts";
import { screenKit } from "./screenKit.ts";
import { settleScreen } from "./settleScreen.ts";

interface State {
	view?: Rendered;
}

function app(window: Duration.Input) {
	return (
		<SessionBoundary
			connect={(_, registry) => {
				const modules = [composedModule("Notes", registry), composedModule("Tasks", registry)];
				return composeBindings(
					{ modules },
					modules.map((module) => module.api),
				);
			}}
			identify={(session) => session}
			liveCoalesceWindow={window}
			recheck={() => undefined}
			session="alice"
		>
			{({ modules }) => modules.map((module) => <ComposedModuleScreen key={module.name} module={module} />)}
		</SessionBoundary>
	);
}

export const composedModules = storyKit(
	screenKit(
		"composed module bindings",
		(): State => ({}),
		(state, screen) => ({
			open: (window: Duration.Input) =>
				Effect.gen(function* () {
					screen.tell(`open Notes and Tasks with a ${window} live window`);
					state.view = yield* screen.open(app(window));
					yield* settleScreen(state.view.container, () => state.view?.container.querySelector('[data-pending="true"]') !== null, screen.tell);
				}),
			shown: () => Effect.sync(() => [...(state.view?.container.querySelectorAll("output") ?? [])].map((node) => node.textContent)),
		}),
	),
);
