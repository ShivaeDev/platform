import { setTimeout } from "node:timers/promises";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { clickButton, Screen } from "#test/Screen.ts";
import { App } from "./App.tsx";
import { openHost } from "./openHost.ts";

export const liveSessionStory = storyKit({
	clock: "live",
	*create() {
		const host = yield* Effect.acquireRelease(Effect.promise(openHost), (value) => Effect.promise(value.close));
		window.location.href = host.url;
		const screen = new Screen(() => undefined);
		const counts = { rechecks: 0 };
		const view = yield* screen.open(
			<App
				rechecked={() => {
					counts.rechecks += 1;
				}}
				session={() => host.state.session}
				signIn={() => {
					host.state.session = "alice";
				}}
				url={host.url}
			/>,
		);
		return { counts, host, screen, view };
	},
	inspect: ({ counts, host, view }) => ({ ...counts, ...host.state, html: view.container.innerHTML }),
	name: "live session",
	stages: ["screen"],
	verbs: ({ counts, host, screen, view }, story) => {
		screen.tell = story.tell;
		return {
			active: () => host.state.active,
			lookups: () => host.state.lookups,
			observe: (line: string, check: () => void) => screen.observe(line, check),
			reads: () => host.state.reads,
			ready: () => view.container.querySelector('[data-live="live"][data-pending="false"]') !== null,
			rechecks: () => counts.rechecks,
			rename: (title: string) => screen.act(`the server renames the note to ${title}`, () => host.rename(title)),
			signIn: () => screen.act("Alice signs in again", () => clickButton(view.container, "Sign in")),
			signOut: () =>
				screen.act("Alice's session is revoked on the server", () => {
					host.state.session = undefined;
				}),
			text: () => view.container.textContent,
			wait: (millis: number) => screen.act(`wait ${millis} milliseconds`, () => setTimeout(millis)),
		};
	},
});
