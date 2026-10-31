import { Deferred, Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PendingCommandScreen } from "./PendingCommandScreen.tsx";
import { pendingCommandClient, ToggleRejected } from "./pendingCommandClient.ts";
import { clickButton, type Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { settleScreen } from "./settleScreen.ts";

interface State {
	client?: ReturnType<typeof pendingCommandClient>;
	view?: Rendered;
}

function container(state: State) {
	if (!state.view) {
		throw new Error("The toggle screen is not open");
	}
	return state.view.container;
}

function client(state: State) {
	if (!state.client) {
		throw new Error("The toggle client is not ready");
	}
	return state.client;
}

function row(state: State, id: number) {
	const element = container(state).querySelector<HTMLElement>(`[data-row="${id}"]`);
	if (!element) {
		throw new Error(`Row ${id} is missing`);
	}
	return element;
}

function button(state: State, id: number) {
	const element = row(state, id).querySelector("button");
	if (!element) {
		throw new Error("The toggle button is missing");
	}
	return element;
}

function answered(state: State, id: number) {
	return row(state, id).querySelector("[data-command]")?.getAttribute("data-command") !== "Initial";
}

function settle(state: State, screen: Screen, pending: () => boolean = () => false) {
	return Effect.suspend(() => settleScreen(container(state), pending, screen.tell));
}

function pendingVerbs(state: State, screen: Screen) {
	function answer(id: number, outcome: string, done: Effect.Effect<boolean>) {
		return screen
			.act(`row ${id}'s command ${outcome}`, () => Effect.runPromise(done.pipe(Effect.andThen(Deferred.await(client(state).commands(id).finished)))))
			.pipe(Effect.andThen(settle(state, screen, () => !answered(state, id))));
	}
	return {
		commandFails: (reason: string, id = 1) =>
			answer(id, `is rejected: ${reason}`, Deferred.fail(client(state).commands(id).gate, new ToggleRejected({ reason }))),
		commandSucceeds: (id = 1) => answer(id, "succeeds", Deferred.succeed(client(state).commands(id).gate, undefined)),
		countResponds: (count: number) =>
			screen
				.act(`the count refetch responds with ${count}`, () => {
					const { countHeld } = client(state);
					return Effect.runPromise(Deferred.succeed(countHeld.gate, count).pipe(Effect.andThen(Deferred.await(countHeld.served))));
				})
				.pipe(Effect.andThen(settle(state, screen))),
		listResponds: (enabled: boolean) =>
			screen
				.act(`the list refetch responds with every row ${enabled ? "enabled" : "disabled"}`, () => {
					const { listHeld } = client(state);
					return Effect.runPromise(Deferred.succeed(listHeld.gate, enabled).pipe(Effect.andThen(Deferred.await(listHeld.served))));
				})
				.pipe(Effect.andThen(settle(state, screen, () => container(state).querySelector('[data-list-pending="true"]') !== null))),
		toggle: (id = 1) => screen.act(`toggle row ${id} on`, () => clickButton(row(state, id), "Enabled")),
	};
}

export const pendingCommands = storyKit(
	screenKit(
		"pending command screen",
		(): State => ({}),
		(state, screen) => ({
			...pendingVerbs(state, screen),
			command: (id = 1) =>
				Effect.sync(() => {
					const output = row(state, id).querySelector("[data-command]");
					const result = output?.getAttribute("data-command");
					if (result === "Failure") {
						return `rejected (${output?.textContent})`;
					}
					return result === "Success" ? "succeeded" : "not answered";
				}),
			serverRows: () =>
				Effect.sync(() =>
					(container(state).querySelector("[data-list-pending]")?.textContent ?? "")
						.split(",")
						.map((value) => (value === "true" ? "enabled" : "disabled")),
				),
			shown: (id = 1) => Effect.sync(() => (button(state, id).getAttribute("aria-pressed") === "true" ? "enabled" : "disabled")),
			toggleState: (id = 1) => Effect.sync(() => (button(state, id).disabled ? "waiting" : "available")),
		}),
	),
);

function rowsDescribed(ids: readonly number[]) {
	return ids.length === 1 ? "one row" : `rows ${ids.join(" and ")}`;
}

function* open({ screen, state }: { readonly screen: Screen; readonly state: State }, ids: readonly number[]) {
	state.client = pendingCommandClient(ids);
	state.view = yield* screen.open(<PendingCommandScreen client={state.client} />);
	yield* settle(state, screen, () => container(state).querySelector("[data-row]") === null);
}

export function toggleScreen(ids: readonly number[] = [1]) {
	return pendingCommands.trait("screen", `a list showing ${rowsDescribed(ids)} disabled on the server, watched with a count query`, (engine) =>
		open(engine, ids),
	);
}

export function toggledOn() {
	return pendingCommands.trait("screen", "a list whose disabled row was toggled on and waits for its command", function* (engine) {
		yield* open(engine, [1]);
		yield* pendingVerbs(engine.state, engine.screen).toggle();
	});
}

export function toggleSucceeded() {
	return pendingCommands.trait("screen", "a list whose row was toggled on and whose command succeeded while its refetches wait", function* (engine) {
		yield* open(engine, [1]);
		const { commandSucceeds, toggle } = pendingVerbs(engine.state, engine.screen);
		yield* toggle();
		yield* commandSucceeds();
	});
}

export function firstSucceededSecondToggled() {
	return pendingCommands.trait("screen", "rows 1 and 2 toggled on, with row 1's command succeeded and waiting for its refetches", function* (engine) {
		yield* open(engine, [1, 2]);
		const { commandSucceeds, toggle } = pendingVerbs(engine.state, engine.screen);
		yield* toggle(1);
		yield* commandSucceeds(1);
		yield* toggle(2);
	});
}
