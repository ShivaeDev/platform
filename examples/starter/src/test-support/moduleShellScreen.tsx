import { createMemoryHistory, createRoute, Link } from "@tanstack/react-router";
import { Effect } from "effect";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import type { ClientModule } from "#client/Module.ts";
import { clientModules } from "#client/modules.ts";
import { SessionApp } from "#client/SessionApp.tsx";
import { appAuth } from "./appAuth.ts";
import { acquireScreen } from "./screenState.ts";
import { screens } from "./screens.ts";

expectNoReactWarnings();

const plainModule: ClientModule = {
	api: {},
	routes: ({ getParentRoute }) => [createRoute({ component: () => <h1>Module home</h1>, getParentRoute, path: "/" })],
};

function contributingModule(name: string): ClientModule {
	return {
		api: {},
		footer: <p>{name} footer</p>,
		menu: [
			<Link key="home" to="/">
				{name} menu
			</Link>,
			<Link key="sign-in" to="/sign-in">
				{name} sign-in
			</Link>,
		],
		overlays: [<aside key="first">{name} overlay</aside>, <aside key="second">{name} second overlay</aside>],
		routes: () => [],
	};
}

export function moduleShellScreen(withSlots: boolean) {
	return screens.trait(
		"screen",
		withSlots ? "two modules contribute every shell slot around a slot-free module" : "a module declares no shell slots",
		function* (engine) {
			const view = yield* acquireScreen(engine);
			const modules = withSlots ? [contributingModule("First"), plainModule, contributingModule("Second")] : [plainModule];
			const auth = appAuth({ baseUrl: "http://shell.story.test" }).auth.actions;
			yield* Effect.promise(() =>
				view.render(
					<SessionApp
						auth={auth}
						connect={(session) => clientModules(session, modules.map(Effect.succeed))}
						history={createMemoryHistory({ initialEntries: ["/"] })}
						recheck={() => undefined}
						userId={undefined}
					/>,
				),
			);
		},
	);
}
