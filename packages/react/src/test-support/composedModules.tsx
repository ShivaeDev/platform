import { Effect } from "effect";
import { composeBindings } from "@shivaedev/contract/composeBindings.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { ComposedModuleScreen } from "#test/ComposedModuleScreen.tsx";
import { composedModule } from "#test/composedModule.ts";
import { screenKit } from "#test/screenKit.ts";
import { settleScreen } from "#test/settleScreen.ts";

interface State {
	view?: Rendered;
}

function app(selected?: readonly string[]) {
	return (
		<SessionBoundary
			connect={(_, registry) => {
				const modules = [composedModule("Notes", registry), composedModule("Tasks", registry)];
				return composeBindings(
					{ modules },
					modules.filter((module) => selected === undefined || selected.includes(module.name)).map((module) => module.api),
				);
			}}
			identify={(session) => session}
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
			open: (selected?: readonly string[]) =>
				Effect.gen(function* () {
					screen.tell("open Notes and Tasks");
					state.view = yield* screen.open(app(selected));
					yield* settleScreen(state.view.container, () => state.view?.container.querySelector('[data-pending="true"]') !== null, screen.tell);
				}),
			shown: () => Effect.sync(() => [...(state.view?.container.querySelectorAll("output") ?? [])].map((node) => node.textContent)),
		}),
	),
);
