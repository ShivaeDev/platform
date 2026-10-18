import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { PendingCommandScreen } from "./PendingCommandScreen.tsx";
import { pendingCommandClient, ToggleRejected } from "./pendingCommandClient.ts";
import { clickButton } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	client: ReturnType<typeof pendingCommandClient>;
	view?: Rendered;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("The toggle screen is not open");
	}
	return state.view.container;
}
export const pendingCommands = storyKit(
	screenKit(
		"pending command screen",
		(): State => ({ client: pendingCommandClient() }),
		(state, screen) => ({
			click: () => screen.act("toggle the list row", () => clickButton(current(state), "Enabled")),
			commandFails: (reason: string) =>
				screen.act("the command is rejected", () => Effect.runPromise(Deferred.fail(state.client.commandGate, new ToggleRejected({ reason })))),
			commandSucceeds: () => screen.act("the command succeeds", () => Effect.runPromise(Deferred.succeed(state.client.commandGate, undefined))),
			countResponds: (count: number) =>
				screen.act(`the count responds with ${count}`, () => Effect.runPromise(Deferred.succeed(state.client.countGate, count))),
			listResponds: (enabled: boolean) =>
				screen.act(`the list responds with enabled=${enabled}`, () => Effect.runPromise(Deferred.succeed(state.client.listGate, enabled))),
			snapshot: () => {
				const container = current(state);
				const button = container.querySelector("button");
				if (!button) {
					throw new Error("The toggle button is missing");
				}
				return {
					command: container.querySelector("[data-command]")?.getAttribute("data-command"),
					enabled: button.getAttribute("aria-pressed") === "true",
					failure: container.querySelector("[data-command]")?.textContent,
					pending: button.disabled,
					server: container.querySelector("[data-list-pending]")?.textContent,
				};
			},
		}),
	),
);
export function toggleScreen() {
	return pendingCommands.trait("screen", "a list row and two queries sharing its invalidation key", function* ({ state, screen }) {
		state.view = yield* screen.open(<PendingCommandScreen client={state.client} />);
	});
}
