import { type Duration, Effect, Queue } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clickButton, Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { connect } from "./connect.ts";
import { Editor } from "./Editor.tsx";
import { openHost } from "./openHost.ts";

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
			passes: (duration: Duration.Input) => screen.act(`${duration} pass on the story clock`, () => run(TestClock.adjust(duration))),
			reconnecting: () => host.waiting,
			releaseHandshake: () => {
				story.tell("the server releases the WebSocket handshake");
				return host.release.pipe(Effect.andThen(Queue.take(connections)));
			},
			save: () =>
				screen
					.act("save the note", () => clickButton(view.container, "Save"))
					.pipe(Effect.andThen(settleScreen(view.container, () => view.container.querySelector('[data-pending="true"]') !== null, story.tell))),
			shown: () => Effect.sync(() => view.container.querySelector("output")?.textContent),
		};
	},
});
