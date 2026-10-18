import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { PendingCommandScreen } from "./PendingCommandScreen.tsx";
import { pendingCommandClient, ToggleRejected } from "./pendingCommandClient.ts";
import { clickButton } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	client?: ReturnType<typeof pendingCommandClient>;
	view?: Rendered;
}
function current(state: State) {
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
	const element = current(state).querySelector<HTMLElement>(`[data-row="${id}"]`);
	if (!element) {
		throw new Error(`Row ${id} is missing`);
	}
	return element;
}
export const pendingCommands = storyKit(
	screenKit(
		"pending command screen",
		(): State => ({}),
		(state, screen) => ({
			click: (id = 1) => screen.act(`toggle row ${id}`, () => clickButton(row(state, id), "Enabled")),
			commandFails: (reason: string, id = 1) =>
				screen.act("the command is rejected", () => Effect.runPromise(Deferred.fail(client(state).commandGate(id), new ToggleRejected({ reason })))),
			commandSucceeds: (id = 1) =>
				screen.act(`row ${id} succeeds`, () => Effect.runPromise(Deferred.succeed(client(state).commandGate(id), undefined))),
			countResponds: (count: number) =>
				screen.act(`the count responds with ${count}`, () => Effect.runPromise(Deferred.succeed(client(state).countGate, count))),
			listResponds: (enabled: boolean) =>
				screen.act(`the list responds with enabled=${enabled}`, () => Effect.runPromise(Deferred.succeed(client(state).listGate, enabled))),
			snapshot: (id = 1) => {
				const container = row(state, id);
				const button = container.querySelector("button");
				if (!button) {
					throw new Error("The toggle button is missing");
				}
				return {
					command: container.querySelector("[data-command]")?.getAttribute("data-command"),
					enabled: button.getAttribute("aria-pressed") === "true",
					failure: container.querySelector("[data-command]")?.textContent,
					pending: button.disabled,
					server: current(state).querySelector("[data-list-pending]")?.textContent,
				};
			},
		}),
	),
);
export function toggleScreen(ids: readonly number[] = [1]) {
	return pendingCommands.trait("screen", "list rows and two queries sharing their invalidation key", function* ({ state, screen }) {
		state.client = pendingCommandClient(ids);
		state.view = yield* screen.open(<PendingCommandScreen client={state.client} />);
	});
}
