import { Effect, Queue } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes } from "@shivaedev/test-story/server/watchedClock.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { connect } from "#test/socket-clock/connect.ts";
import { Editor } from "#test/socket-clock/Editor.tsx";
import { openHost } from "#test/socket-clock/openHost.ts";

export const socketClockStory = storyKit({
	clock: "test",
	*create() {
		const host = yield* openHost;
		const connections = yield* Queue.unbounded<string>();
		const client = yield* connect(host.url, connections);
		const run = Effect.runPromiseWith(yield* Effect.context());
		const screen = new Screen(() => undefined);
		const view = yield* screen.open(<Editor client={client} />);
		return { connections, host, run, screen, view };
	},
	inspect: ({ host, view }) => ({ ...host.state, html: view.container.innerHTML }),
	name: "shared socket on a story clock",
	stages: ["screen"],
	verbs: ({ connections, host, run, screen, view }, story) => {
		screen.tell = story.tell;
		return {
			dropSocket: () =>
				Effect.gen(function* () {
					story.tell("the server drops the socket and holds its next WebSocket handshake");
					yield* Queue.take(connections);
					yield* host.disconnect();
					yield* Queue.take(connections);
				}),
			handshakes: () => Effect.sync(() => host.state.handshakes),
			minutePasses: () => screen.act("a minute passes on the story clock", () => run(passes("1 minute", Effect.void))),
			reconnectDelayPasses: () =>
				screen
					.act("the reconnect delay passes and the next handshake reaches the server", () => run(passes("1 second", Effect.void)))
					.pipe(Effect.andThen(host.waiting)),
			releaseHandshake: () => {
				story.tell("the server releases the WebSocket handshake");
				return host.release.pipe(Effect.andThen(Queue.take(connections)));
			},
			save: () =>
				screen
					.driver(view.container)
					.click({ name: "Save", role: "button" })
					.pipe(Effect.andThen(settleScreen(view.container, () => view.container.querySelector('[data-pending="true"]') !== null, story.tell))),
			shown: () => Effect.sync(() => view.container.querySelector("output")?.textContent),
		};
	},
});
