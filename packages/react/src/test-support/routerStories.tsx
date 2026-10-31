import { RouterProvider } from "@tanstack/react-router";
import { Deferred, Effect } from "effect";
import { act } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { routerApp } from "./routerApp.ts";
import { type NoteMissing, NotFound, routerClient } from "./routerClient.ts";
import { clickButton, type Screen, screenWarnings, typeInput } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { settleScreen } from "./settleScreen.ts";

interface State {
	readonly client: ReturnType<typeof routerClient>;
	marked?: { readonly input: Element | null; readonly shell: Element | null };
	root?: Rendered;
	router?: ReturnType<typeof routerApp>;
}

function current(state: State) {
	if (!(state.root && state.router)) {
		throw new Error("No router screen");
	}
	return { root: state.root, router: state.router };
}

function text(state: State, selector: string) {
	return current(state).root.container.querySelector(selector)?.textContent ?? "none";
}

function settle(state: State, screen: Screen) {
	const { root, router } = current(state);
	return settleScreen(root.container, () => router.state.isLoading || router.state.matches.some((match) => match.isFetching !== false), screen.tell);
}

function requestArrives(state: State, screen: Screen) {
	const count = state.client.calls.length + 1;
	return screen.act("wait for the server to receive the request", () => state.client.requestArrives(count));
}

function answer(state: State, screen: Screen, id: string, title: string, page: number) {
	return screen
		.act(`the server answers note ${id} page ${page}: ${title}`, () =>
			Effect.runPromise(Deferred.succeed(state.client.gate(id, page), { id, title })),
		)
		.pipe(Effect.andThen(settle(state, screen)));
}

function reject(state: State, screen: Screen, failure: NoteMissing | NotFound) {
	const answerLine = failure instanceof NotFound ? "not found" : "missing";
	return screen
		.act(`the server answers that note ${failure.id} is ${answerLine}`, () =>
			Effect.runPromise(Deferred.fail(state.client.gate(failure.id), failure)),
		)
		.pipe(Effect.andThen(settle(state, screen)));
}

function marked(state: State, key: "input" | "shell", selector: string) {
	const element = current(state).root.container.querySelector(selector);
	if (element === null) {
		return "missing";
	}
	return element === state.marked?.[key] ? "original" : "replaced";
}

function routeVerbs(state: State, screen: Screen) {
	return {
		alert: () => Effect.sync(() => text(state, "[role=alert]")),
		answer: (id: string, title: string, page = 1) => answer(state, screen, id, title, page),
		changePage: (page: number) =>
			screen
				.act(`change the page to ${page}`, () => {
					void current(state).router.navigate({ params: { id: "first" }, search: { page }, to: "/notes/$id" });
				})
				.pipe(Effect.andThen(requestArrives(state, screen))),
		clientRuntimes: () => Effect.sync(() => state.client.builds()),
		firstFrame: () => Effect.sync(() => state.client.frames[0] ?? "none"),
		heading: () => Effect.sync(() => text(state, "h1")),
		navigating: () => Effect.sync(() => text(state, "[data-pending]")),
		openSecondNote: () =>
			screen
				.act("click the Second note link", () => {
					const link = current(state).root.container.querySelector<HTMLAnchorElement>("a");
					if (!link) {
						throw new Error("No second note link");
					}
					link.click();
				})
				.pipe(Effect.andThen(requestArrives(state, screen))),
		queryText: () => Effect.sync(() => text(state, "[data-query]")),
		reject: (failure: NoteMissing | NotFound) => reject(state, screen, failure),
		requests: () => Effect.sync(() => state.client.calls.map(({ id, page }) => `${id} page ${page}`)),
		retry: () => {
			state.client.next("first");
			return screen.act("click Retry", () => clickButton(current(state).root.container, "Retry")).pipe(Effect.andThen(requestArrives(state, screen)));
		},
		routeError: () => Effect.sync(() => current(state).router.state.matches.at(-1)?.error),
		shell: () =>
			Effect.sync(() => ({
				draft: current(state).root.container.querySelector<HTMLInputElement>('[name="shell"]')?.value ?? "missing",
				input: marked(state, "input", '[name="shell"]'),
				shell: marked(state, "shell", "main"),
			})),
		typeShellDraft: (value: string) => screen.act(`type ${value} into the shell`, () => typeInput(current(state).root.container, "shell", value)),
	};
}

export const routes = storyKit(screenKit("notes route screen", (): State => ({ client: routerClient() }), routeVerbs));

interface Engine {
	readonly screen: Screen;
	readonly state: State;
}

function* openRoute({ screen, state }: Engine, initial: string, expectedFailure?: NoteMissing) {
	const root = yield* screen.open(
		null,
		expectedFailure ? { onCaughtError: screenWarnings.expectCaughtError((error) => error === expectedFailure) } : undefined,
	);
	state.root = root;
	const router = routerApp(root.registry, state.client, initial);
	state.router = router;
	yield* Effect.promise(() => act(() => root.render(<RouterProvider router={router} />)));
	yield* screen.act(`the loader at ${initial} reaches the server`, () => state.client.requestArrives(1));
}

export function routeRequested(initial = "/notes/first", expectedFailure?: NoteMissing) {
	return routes.trait("screen", `the notes router opened ${initial} and its loader's request waits on the server`, (engine) =>
		openRoute(engine, initial, expectedFailure),
	);
}

export function firstNoteShown(title: string) {
	return routes.trait("screen", `the notes router shows note first: ${title}`, function* (engine) {
		yield* openRoute(engine, "/notes/first");
		yield* answer(engine.state, engine.screen, "first", title, 1);
	});
}

export function pageTwoRequested() {
	return routes.trait("screen", "the notes router showed First page, then changed to page 2 and waits on the server", function* (engine) {
		yield* openRoute(engine, "/notes/first");
		yield* answer(engine.state, engine.screen, "first", "First page", 1);
		yield* routeVerbs(engine.state, engine.screen).changePage(2);
	});
}

export function secondNoteRequested() {
	return routes.trait("screen", "the notes router showed First note, then the Second note link's request waits on the server", function* (engine) {
		yield* openRoute(engine, "/notes/first");
		yield* answer(engine.state, engine.screen, "first", "First note", 1);
		yield* routeVerbs(engine.state, engine.screen).openSecondNote();
	});
}

function* failLoader(engine: Engine, failure: NoteMissing, draft: string) {
	yield* openRoute(engine, "/notes/first", failure);
	yield* reject(engine.state, engine.screen, failure);
	yield* routeVerbs(engine.state, engine.screen).typeShellDraft(draft);
	const { container } = current(engine.state).root;
	engine.state.marked = { input: container.querySelector('[name="shell"]'), shell: container.querySelector("main") };
}

export function loaderFailed(failure: NoteMissing, draft: string) {
	return routes.trait("screen", `the note's loader failed as ${failure._tag} and the shell input holds ${draft}`, (engine) =>
		failLoader(engine, failure, draft),
	);
}

export function retryRequested(failure: NoteMissing, draft: string) {
	return routes.trait(
		"screen",
		`the note's loader failed as ${failure._tag}, the shell input holds ${draft} and a retry waits on the server`,
		function* (engine) {
			yield* failLoader(engine, failure, draft);
			yield* routeVerbs(engine.state, engine.screen).retry();
		},
	);
}
