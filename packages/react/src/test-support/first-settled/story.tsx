import { Deferred, Effect, type Layer } from "effect";
import { StrictMode } from "react";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import type { QueryStorageProvider } from "@shivaedev/contract/QueryStorage.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type FirstSettledClient, firstSettledClient, storedResults } from "#test/first-settled/client.ts";
import type { FirstRoute, Provider } from "#test/first-settled/routed.tsx";
import { type FirstReads, View } from "#test/first-settled/View.tsx";
import type { Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { settleScreen } from "#test/settleScreen.ts";

type User = "alice" | "bob";
type Query = "author" | "count" | "title";

interface State {
	readonly clients: Map<string, FirstSettledClient>;
	persist?: Layer.Layer<QueryStorageProvider>;
	reads: FirstReads;
	routed?: { readonly provider: Provider; readonly route: FirstRoute; readonly strict: boolean };
	user?: User;
	view?: Rendered;
	warmCount: boolean;
}

function opened(state: State) {
	const client = state.user === undefined ? undefined : state.clients.get(state.user);
	if (state.view === undefined || client === undefined) {
		throw new Error("No screen is open; give the story a screen trait");
	}
	return { client, container: state.view.container, view: state.view };
}

function show(state: State, screen: Screen, user: User, line: string) {
	state.user = user;
	function connect(session: string) {
		const client = firstSettledClient();
		state.clients.set(session, client);
		return client;
	}
	const view = (
		<View connect={connect} persist={state.persist} reads={state.reads} routed={state.routed} session={user} warmCount={state.warmCount} />
	);
	const node = state.routed?.strict === true ? <StrictMode>{view}</StrictMode> : view;
	return Effect.gen(function* () {
		// StrictMode replays effects for a tree that mounts into an open root, so a strict screen opens empty first.
		if (state.view === undefined && state.routed?.strict === true) {
			state.view = yield* screen.open();
		}
		const root = state.view;
		if (root === undefined) {
			screen.tell(line);
			state.view = yield* screen.open(node);
		} else {
			yield* screen.act(line, () => root.render(node));
		}
	});
}

function verbs(state: State, screen: Screen) {
	function answers(query: Query, value: string) {
		return Effect.suspend(() => {
			const { client, container } = opened(state);
			return screen
				.act(`${state.user}'s ${query} query answers ${value}`, () => Effect.runPromise(Deferred.succeed(client.held[query], value)))
				.pipe(Effect.andThen(settleScreen(container, () => container.querySelector(`[data-answer="${query}"]`)?.textContent !== value, screen.tell)));
		});
	}
	function click(name: string) {
		return Effect.suspend(() => screen.driver(opened(state).container).click({ name, role: "button" }));
	}
	return {
		activity: () =>
			Effect.suspend(() => clientActivity(opened(state).client.client).current).pipe(
				Effect.map(({ commands, initialQueries }) => ({ commands, initialQueries })),
			),
		answer: (query: Query | "blank") =>
			Effect.sync(() => {
				const shown = opened(state).container.querySelector(`[data-answer="${query}"]`);
				const marks = ["stale", "refreshing"].filter((mark) => shown?.getAttribute(`data-${mark}`) === "true");
				return marks.length === 0 ? (shown?.textContent ?? "not shown") : `${shown?.textContent} (${marks.join(", ")})`;
			}),
		answers,
		command: () =>
			Effect.sync(() =>
				opened(state).container.querySelector("[data-command]")?.getAttribute("data-command") === "Success" ? "finished" : "unfinished",
			),
		count: () => Effect.sync(() => opened(state).container.querySelector('[data-answer="count"]')?.textContent ?? "not shown"),
		renameFinishes: () =>
			Effect.suspend(() => {
				const { client, container } = opened(state);
				return screen
					.act("the server finishes the rename", () => Effect.runPromise(Deferred.succeed(client.held.rename, undefined)))
					.pipe(
						Effect.andThen(
							settleScreen(container, () => container.querySelector("[data-command]")?.getAttribute("data-command") !== "Success", screen.tell),
						),
					);
			}),
		showCount: () => click("Show count"),
		signal: () => Effect.sync(() => opened(state).container.querySelector('[role="status"]')?.textContent ?? "no signal"),
		signIn: (user: User) => show(state, screen, user, `${user} signs in, starting a new session generation`),
		startRename: () =>
			click("Rename").pipe(
				Effect.andThen(
					Effect.suspend(() =>
						screen.act("the rename reaches the server, which holds it", () => Effect.runPromise(Deferred.await(opened(state).client.renameArrived))),
					),
				),
			),
	};
}

export const firstSettledScreens = storyKit(
	screenKit("first results screen", (): State => ({ clients: new Map(), reads: "title and author", warmCount: false }), verbs),
);

export function aliceOpens(reads: FirstReads = "title and author", warm: "count" | "nothing" = "nothing") {
	const waiting = {
		"count after its first render": ", and the server has not answered it",
		"no query": "",
		"title and author": ", and the server has answered neither",
	}[reads];
	const kept = warm === "count" ? ", while her session keeps the count query warm and the server has not answered it" : "";
	return firstSettledScreens.trait("screen", `alice opens a screen that reads ${reads} through her client${waiting}${kept}`, ({ screen, state }) => {
		state.reads = reads;
		state.warmCount = warm === "count";
		return show(state, screen, "alice", "alice opens the screen");
	});
}

export const aliceSeesFirstResults = firstSettledScreens.trait(
	"screen",
	"alice's screen shows its title and author, the first results of her session",
	function* ({ screen, state }) {
		yield* show(state, screen, "alice", "alice opens the screen");
		const { answers } = verbs(state, screen);
		yield* answers("title", "Groceries");
		yield* answers("author", "alice");
	},
);

export const aliceReloadsWithStoredResults = firstSettledScreens.trait(
	"screen",
	"alice reloads her screen that reads title and author while the device holds her stored title Groceries and author alice, and the server has answered neither",
	({ screen, state }) => {
		state.persist = storedResults("alice", { author: "alice", title: "Groceries" });
		return show(state, screen, "alice", "alice opens the screen");
	},
);

export function aliceOpensRoute(route: FirstRoute, provider: Provider = "react's", strict: "in StrictMode" | "" = "") {
	const waiting = route === "nothing" ? "" : ", and the server has not answered it";
	return firstSettledScreens.trait(
		"screen",
		`alice opens a screen${strict === "" ? "" : ` ${strict}`} that calls useFirstSettled above ${provider} RouterProvider, whose first route reads ${route}${waiting}`,
		({ screen, state }) => {
			state.routed = { provider, route, strict: strict === "in StrictMode" };
			const shown = { "a component that reads the title": "title", "a loader that reads the title": undefined, nothing: "blank" }[route];
			return show(state, screen, "alice", "alice opens the screen").pipe(
				Effect.andThen(
					Effect.suspend(() => {
						const { container } = opened(state);
						return shown === undefined
							? Effect.void
							: settleScreen(container, () => container.querySelector(`[data-answer="${shown}"]`) === null, screen.tell);
					}),
				),
			);
		},
	);
}
