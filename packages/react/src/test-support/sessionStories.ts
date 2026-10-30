import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { startServer } from "#test/order-example/startServer.ts";
import { clickButton, type Screen, typeInput } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { type Session, sessions, shell } from "./session.tsx";

type User = "alice" | "bob";

const orders = { alice: 1, bob: 2 } as const;

interface State {
	readonly active: ReturnType<typeof sessions>;
	current?: { readonly session: Session | undefined; readonly order: number };
	readonly signIns: Record<User, number>;
	view?: ReturnType<typeof shell>;
}

function opened(state: State) {
	if (!state.view) {
		throw new Error("No session screen");
	}
	return state.view;
}

function sessionVerbs(state: State, screen: Screen) {
	function settle() {
		const view = opened(state);
		return screenDriver({
			act: async (action) => {
				await act(action);
			},
			pending: view.pending,
			root: view.container,
			tell: screen.tell,
		}).settle();
	}
	function show(line: string, session: Session | undefined, order: number) {
		state.current = { order, session };
		return screen.act(line, () => opened(state).show(session, order)).pipe(Effect.andThen(settle()));
	}
	function field() {
		return opened(state).container.querySelector<HTMLInputElement>('input[name="name"]');
	}
	return {
		alert: () => Effect.sync(() => opened(state).container.querySelector('[role="alert"]')?.textContent ?? "no alert"),
		close: () => screen.act("close the session screen", () => opened(state).close()),
		draft: () => Effect.sync(() => field()?.value ?? "no form"),
		heldAtoms: (session: string) =>
			Effect.sync(() => {
				const registry = opened(state).registries.get(session);
				if (registry === undefined) {
					throw new Error(`Session ${session} never rendered`);
				}
				return registry.getNodes().size;
			}),
		rechecks: () => Effect.sync(() => [...opened(state).rechecks]),
		refresh: () => screen.act("refresh the order", () => clickButton(opened(state).container, "Refresh")).pipe(Effect.andThen(settle())),
		screenText: () => Effect.sync(() => opened(state).container.textContent),
		sessionExpires: (user: User) =>
			Effect.sync(() => {
				screen.tell(`${user}'s session expires on the server`);
				state.active.delete(`${user}-token`);
			}),
		sessionIsValidAgain: (user: User) =>
			Effect.sync(() => {
				screen.tell(`${user}'s session is valid on the server again`);
				state.active.set(`${user}-token`, { expiresAt: Number.POSITIVE_INFINITY, userId: user });
			}),
		sessionRegistries: () => Effect.sync(() => [...opened(state).registries.keys()]),
		showAgain: () => {
			const current = state.current;
			if (current === undefined) {
				throw new Error("No session was shown");
			}
			return show(`show ${current.session?.id ?? "the signed-out screen"} again`, current.session, current.order);
		},
		shownOrder: () => Effect.sync(() => opened(state).container.querySelector('[data-testid="server-order"]')?.textContent ?? "no order"),
		signIn: (user: User) => {
			state.signIns[user] += 1;
			const id = `${user}-${state.signIns[user]}`;
			return show(`${user} signs in as session ${id}`, { id, token: `${user}-token` }, orders[user]);
		},
		signOut: () => show("sign out", undefined, state.current?.order ?? orders.alice),
		type: (value: string) => screen.act(`type the order name ${value}`, () => typeInput(opened(state).container, "name", value)),
	};
}

export const sessionScreens = storyKit(
	screenKit("order sessions over loopback HTTP", (): State => ({ active: sessions(), signIns: { alice: 0, bob: 0 } }), sessionVerbs),
);

function* openSessions({ screen, state }: { screen: Screen; state: State }) {
	const server = yield* Effect.acquireRelease(
		Effect.promise(() => startServer({ sessions: state.active })),
		(host) => Effect.promise(host.close),
	);
	state.view = shell(server.url, yield* screen.open());
}

export function aliceSignedIn() {
	return sessionScreens.trait("screen", "alice is signed in as alice-1 and sees her order", function* (engine) {
		yield* openSessions(engine);
		yield* sessionVerbs(engine.state, engine.screen).signIn("alice");
	});
}

export function aliceEdited(draft: string) {
	return sessionScreens.trait("screen", `alice is signed in as alice-1 and typed ${draft} over her order's name`, function* (engine) {
		yield* openSessions(engine);
		const verbs = sessionVerbs(engine.state, engine.screen);
		yield* verbs.signIn("alice");
		yield* verbs.type(draft);
	});
}

export function aliceRefreshedAfterExpiry(draft: string) {
	return sessionScreens.trait("screen", `alice typed ${draft}, her session expired and her refresh failed`, function* (engine) {
		yield* openSessions(engine);
		const verbs = sessionVerbs(engine.state, engine.screen);
		yield* verbs.signIn("alice");
		yield* verbs.type(draft);
		yield* verbs.sessionExpires("alice");
		yield* verbs.refresh();
	});
}
