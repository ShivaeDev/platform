import { Deferred, Effect, Queue } from "effect";
import { activityScreenSignal } from "@shivaedev/contract/clientActivity.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { ReflectedSwitchScreen } from "#test/PendingCommandScreen.tsx";
import { connect, type SwitchClient } from "#test/reflected-switch/connect.ts";
import { openHost } from "#test/reflected-switch/openHost.ts";
import type { Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

interface Open {
	readonly client: SwitchClient;
	readonly earlier: string[];
	readonly host: Effect.Success<typeof openHost>;
	readonly observer: MutationObserver;
	readonly view: Rendered;
}

interface State {
	open?: Open;
}

function opened(state: State) {
	if (!state.open) {
		throw new Error("The switch screen is not open");
	}
	return state.open;
}

function button(state: State) {
	const element = opened(state).view.container.querySelector("button");
	if (!element) {
		throw new Error("The switch is missing");
	}
	return element;
}

function onOff(pressed: string | null) {
	return pressed === "true" ? "on" : "off";
}

function unreflected(state: State, count: number, name: string) {
	return until(opened(state).client.activity, (activity) => activity.commands === 0 && activity.unreflectedCommands === count, { name });
}

export const reflectedSwitch = storyKit(
	screenKit(
		"switch on a host that confirms commands",
		(): State => ({}),
		(state, screen) => ({
			commandAccepted: () =>
				screen.act("the server accepts the command and starts the update it holds", () =>
					Effect.runPromise(Effect.andThen(Queue.take(opened(state).host.updating), unreflected(state, 1, "the command's reply"))),
				),
			commandResult: () =>
				Effect.sync(() => {
					const result = opened(state).view.container.querySelector("[data-command]")?.getAttribute("data-command");
					return result === "Success" ? "succeeded" : "not answered";
				}),
			settle: () => {
				const { client, view } = opened(state);
				return screen.driver(view.container, activityScreenSignal(client.activity)).settle();
			},
			shown: () => Effect.sync(() => onOff(button(state).getAttribute("aria-pressed"))),
			shownSinceOpening: () =>
				Effect.sync(() => {
					const { earlier, observer } = opened(state);
					earlier.push(...observer.takeRecords().map((record) => onOff(record.oldValue)));
					return [...earlier, onOff(button(state).getAttribute("aria-pressed"))];
				}),
			switchState: () => Effect.sync(() => (button(state).disabled ? "waiting" : "available")),
			toggle: () => screen.driver(opened(state).view.container).click({ name: "Enabled", role: "button" }),
			updateArrives: () =>
				screen
					.act("the server finishes the held update", () => {
						const { stored } = opened(state).host;
						const held = stored.update;
						stored.update = undefined;
						return Effect.runPromise(
							Effect.andThen(held === undefined ? Effect.void : Deferred.succeed(held, undefined), unreflected(state, 0, "the command reflected")),
						);
					})
					.pipe(Effect.andThen(Effect.suspend(() => settleScreen(opened(state).view.container, () => false, screen.tell)))),
		}),
	),
);

function* open({ screen, state }: { readonly screen: Screen; readonly state: State }) {
	const host = yield* openHost;
	const client = connect(host.url, yield* storyRuntime);
	const view = yield* screen.open(<ReflectedSwitchScreen client={client} />);
	yield* screen.driver(view.container, activityScreenSignal(client.activity)).find({ name: "Enabled", role: "button" });
	const earlier: string[] = [];
	const observer = yield* Effect.acquireRelease(
		Effect.sync(() => {
			const created = new MutationObserver((records) => earlier.push(...records.map((record) => onOff(record.oldValue))));
			created.observe(view.container.querySelector("button") ?? view.container, { attributeFilter: ["aria-pressed"], attributeOldValue: true });
			return created;
		}),
		(created) => Effect.sync(() => created.disconnect()),
	);
	state.open = { client, earlier, host, observer, view };
	return state.open;
}

export function switchWithHeldUpdate() {
	return reflectedSwitch.trait("screen", "a switch showing Off whose server holds the update a command causes", function* (engine) {
		const { host } = yield* open(engine);
		host.stored.update = yield* Deferred.make<void>();
	});
}

export function switchTheServerKeepsOff() {
	return reflectedSwitch.trait("screen", "a switch showing Off whose server accepts commands and keeps it off", function* (engine) {
		const { host } = yield* open(engine);
		host.stored.keepsOff = true;
	});
}
