import { Deferred, Effect } from "effect";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type FirstSettledClient, firstSettledClient } from "#test/first-settled/client.ts";
import { View } from "#test/first-settled/View.tsx";
import type { Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { settleScreen } from "#test/settleScreen.ts";

type User = "alice" | "bob";
type Query = "author" | "count" | "title";

interface State {
	readonly clients: Map<string, FirstSettledClient>;
	reads: boolean;
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
	const node = <View connect={connect} reads={state.reads} session={user} warmCount={state.warmCount} />;
	return Effect.gen(function* () {
		const view = state.view;
		if (view === undefined) {
			screen.tell(line);
			state.view = yield* screen.open(node);
		} else {
			yield* screen.act(line, () => view.render(node));
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
		answers,
		command: () =>
			Effect.sync(() =>
				opened(state).container.querySelector("[data-command]")?.getAttribute("data-command") === "Success" ? "finished" : "unfinished",
			),
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
	screenKit("first results screen", (): State => ({ clients: new Map(), reads: true, warmCount: false }), verbs),
);

export function aliceOpens(reads: "title and author" | "no query" = "title and author", warm: "count" | "nothing" = "nothing") {
	const waiting = reads === "no query" ? "" : ", and the server has answered neither";
	const kept = warm === "count" ? ", while her session keeps the count query warm and the server has not answered it" : "";
	return firstSettledScreens.trait("screen", `alice opens a screen that reads ${reads} through her client${waiting}${kept}`, ({ screen, state }) => {
		state.reads = reads !== "no query";
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
