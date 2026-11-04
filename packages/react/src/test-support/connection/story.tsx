import { Effect, Queue } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { TestClock } from "effect/testing";
import { activityScreenSignal, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { querySignals } from "@shivaedev/contract/querySignals.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { Screen } from "#test/Screen.ts";
import { connect } from "./connect.ts";
import { openHost } from "./openHost.ts";
import { View } from "./View.tsx";

export const connections = storyKit({
	clock: "test",
	*create() {
		const host = yield* openHost;
		const connection = yield* connect(host.url);
		const screen = new Screen(() => undefined);
		const view = yield* screen.open(<View {...connection} />);
		const run = Effect.runPromiseWith(yield* Effect.context());
		const activity = clientActivity(connection.client);
		return { activity, connection, host, run, screen, view };
	},
	inspect: ({ view }) => ({ html: view.container.innerHTML }),
	name: "client connection screen",
	stages: ["screen"],
	verbs: ({ activity, connection, host, run, screen, view }, story) => {
		screen.tell = story.tell;
		function status(value: "live" | "reconnecting") {
			return until(activity, (state) => state.connectionStatus === value, { name: `client ${value}` });
		}
		function queryAnswered() {
			return until(
				AtomRegistry.toStream(view.registry, connection.client.api.get.query()),
				(result) => AsyncResult.isSuccess(result) && result.value === host.state.title,
				{ name: "resumed query" },
			);
		}
		return {
			activityStatus: () => Effect.map(activity.current, (state) => state.connectionStatus),
			closeNote: () =>
				screen
					.act("close the primary note query", () => {
						const button = [...view.container.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === "Close note");
						if (button === undefined) {
							throw new Error("Missing close button");
						}
						button.click();
					})
					.pipe(Effect.andThen(Queue.take(host.closed))),
			dropSocket: () =>
				screen.act("drop the socket and hold the next handshake", () =>
					run(host.drop.pipe(Effect.andThen(Queue.take(connection.events)), Effect.andThen(host.waiting))),
				),
			outagePasses: () =>
				screen.act("thirty seconds pass while the socket is unavailable", () =>
					run(TestClock.adjust("30 seconds").pipe(Effect.andThen(status("reconnecting")))),
				),
			refreshNote: () =>
				screen.act("refresh the note", async () => {
					const signals = querySignals(connection.client.api.get.query());
					const before = view.registry.get(signals).completed;
					const button = [...view.container.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === "Refresh note");
					if (button === undefined) {
						throw new Error("Missing refresh button");
					}
					button.click();
					await run(until(AtomRegistry.toStream(view.registry, signals), ({ completed }) => completed > before, { name: "refreshed query" }));
				}),
			refuseNote: () =>
				Effect.sync(() => {
					story.tell("the server refuses the note");
					host.state.refused = true;
				}),
			renameNote: () =>
				Effect.sync(() => {
					story.tell("another client renames the note while disconnected");
					host.state.title = "Changed while away";
				}),
			restoreSocket: () => screen.act("restore the socket", () => run(host.restore.pipe(Effect.andThen(Queue.take(connection.events))))),
			resume: (source: "online" | "visibilitychange") =>
				screen
					.act(`the browser sends ${source}`, async () => {
						window.dispatchEvent(new Event(source));
						await run(queryAnswered());
					})
					.pipe(Effect.andThen(screenDriver({ activity: activityScreenSignal(activity), root: view.container, tell: story.tell }).settle())),
			settleStatus: () => screen.act("the connection notice settles", () => run(TestClock.adjust("300 millis").pipe(Effect.andThen(status("live"))))),
			shown: () =>
				Effect.sync(() => ({
					connection: view.container.querySelector('[role="status"]')?.textContent,
					data: [...view.container.querySelectorAll("output")].map((output) => output.textContent),
					refusal: view.container.querySelector('[role="alert"]')?.textContent ?? "",
				})),
		};
	},
});
export const watching = connections.trait("screen", "two bindings show their live data", function* ({ connection, run, screen, view }) {
	yield* screen.act("wait for the socket and both queries", () =>
		run(
			Effect.gen(function* () {
				yield* Queue.take(connection.events);
				yield* AtomRegistry.getResult(view.registry, connection.client.api.get.query());
				yield* AtomRegistry.getResult(view.registry, connection.summary.get.query());
			}),
		),
	);
});
