import { createMemoryHistory, createRoute, Link } from "@tanstack/react-router";
import { Effect } from "effect";
import { clientApp } from "@shivaedev/react/client/app.ts";
import { type ClientModule, clientModule } from "@shivaedev/react/client/module.ts";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { SessionApp } from "#client/SessionApp.tsx";
import { appAuth } from "#test-support/appAuth.ts";
import { acquireScreen, type ScreenSurface } from "#test-support/screenState.ts";
import { screens } from "#test-support/screens.ts";

expectNoReactWarnings();

const plainModule = clientModule({}, () => ({
	routes: (root) => [createRoute({ component: () => <h1>Module home</h1>, getParentRoute: () => root, path: "/" })],
}));

function contributingModule(name: string) {
	return clientModule({}, () => ({
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
	}));
}

type ShellPath = "/" | "/timer" | "/workout";

function neverLoads(path: ShellPath, stillLoading: ShellPath | undefined) {
	return path === stillLoading ? { loader: () => Effect.runPromise(Effect.never) } : {};
}

const workoutContent = (
	<>
		<h1>Workout</h1>
		<Link to="/">Leave workout</Link>
	</>
);

function fullScreenModule(stillLoading: ShellPath | undefined) {
	return clientModule({}, () => ({
		routes: (root) => {
			const workout = createRoute({ getParentRoute: () => root, id: "workout", staticData: { fullScreen: true } });
			return [
				createRoute({
					component: () => <h1>Module home</h1>,
					getParentRoute: () => root,
					...neverLoads("/", stillLoading),
					path: "/",
				}),
				createRoute({
					component: () => <h1>Timer</h1>,
					getParentRoute: () => root,
					...neverLoads("/timer", stillLoading),
					path: "/timer",
					staticData: { fullScreen: true },
				}),
				workout.addChildren([
					createRoute({
						component: () => workoutContent,
						getParentRoute: () => workout,
						...neverLoads("/workout", stillLoading),
						path: "/workout",
					}),
				]),
			];
		},
	}));
}

const openShell = Effect.fnUntraced(function* (engine: ScreenSurface, modules: readonly ClientModule[], path: string) {
	const view = yield* acquireScreen(engine);
	const auth = appAuth({ baseUrl: "http://shell.story.test" }).auth.actions;
	yield* Effect.promise(() =>
		view.render(
			<SessionApp
				app={clientApp(modules)}
				auth={auth}
				history={createMemoryHistory({ initialEntries: [path] })}
				recheck={() => undefined}
				userId={undefined}
			/>,
		),
	);
});

export function moduleShellScreen(withSlots: boolean) {
	return screens.trait(
		"screen",
		withSlots ? "two modules contribute every shell slot around a slot-free module" : "a module declares no shell slots",
		(engine) => openShell(engine, withSlots ? [contributingModule("First"), plainModule, contributingModule("Second")] : [plainModule], "/"),
	);
}

export function fullScreenShellScreen(path: "/timer" | "/workout", stillLoading?: ShellPath) {
	const declared = path === "/timer" ? "declares fullScreen itself" : "sits under a parent route that declares fullScreen";
	const loading = stillLoading === undefined ? "" : `, and ${stillLoading} never finishes loading`;
	return screens.trait(
		"screen",
		`the app opens at ${path}, which ${declared}, between two modules that contribute every shell slot${loading}`,
		(engine) => openShell(engine, [contributingModule("First"), fullScreenModule(stillLoading), contributingModule("Second")], path),
	);
}
