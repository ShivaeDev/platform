import { Effect, Queue } from "effect";
import { TestClock } from "effect/testing";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { connect } from "#test/socket-clock/connect.ts";
import { openHost } from "#test/socket-clock/openHost.ts";
import { View } from "./View.tsx";

export const commandReconnect = storyKit({
	clock: "test",
	*create() {
		const host = yield* openHost;
		const connections = yield* Queue.unbounded<string>();
		const client = yield* connect(host.url, connections, true);
		const run = Effect.runPromiseWith(yield* Effect.context());
		const screen = new Screen(() => undefined);
		const view = yield* screen.open(<View client={client} />);
		yield* screen.act("open the client connection", () =>
			run(Effect.sync(() => view.registry.mount(client.runtime)).pipe(Effect.andThen(Queue.take(connections)))),
		);
		const activity = clientActivity(client.connection);
		return { activity, client, connections, host, run, screen, view };
	},
	inspect: ({ view }) => ({ html: view.container.innerHTML }),
	name: "save through reconnection",
	stages: ["connection"],
	verbs: ({ activity, connections, host, run, screen, view }, story) => {
		screen.tell = story.tell;
		return {
			drop: () => screen.act("the socket drops", () => run(host.disconnect().pipe(Effect.andThen(Queue.take(connections))))),
			pass: (milliseconds: number) => screen.act(`${milliseconds} milliseconds pass`, () => run(TestClock.adjust(milliseconds))),
			restore: () => screen.act("the server accepts connections again", () => run(host.release)),
			resume: (source: "online" | "visibilitychange" | "pageshow") =>
				screen.act(`the browser sends ${source}`, () => window.dispatchEvent(new Event(source))),
			save: () => screen.driver(view.container).click({ name: "Save", role: "button" }),
			settle: () => settleScreen(view.container, () => view.container.querySelector('[data-pending="true"]') !== null, story.tell),
			shown: () =>
				Effect.sync(() => ({
					connection: view.container.querySelector('[role="status"]')?.textContent,
					pending: view.container.querySelector("button")?.disabled,
					result: view.container.querySelector("output")?.textContent,
				})),
			silence: () => screen.act("the open socket silently stops delivering frames", () => run(host.silence)),
			untilTimeout: () => settleScreen(view.container, () => view.container.querySelector('[data-pending="true"]') !== null, story.tell),
			untilWaiting: () =>
				screen.act("the command waits for connection", () =>
					run(until(activity, (state) => state.connectionStatus === "waiting-for-connection", { name: "held save" })),
				),
		};
	},
});

export const connected = commandReconnect.trait("connection", "the client has a live socket", function* ({ screen, view }) {
	yield* screen.driver(view.container).click({ name: "Save", role: "button" });
	yield* settleScreen(
		view.container,
		() => view.container.querySelector('[data-pending="true"]') !== null,
		() => undefined,
	);
});
