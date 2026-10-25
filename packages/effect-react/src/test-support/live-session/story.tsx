import { setTimeout } from "node:timers/promises";
import { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
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
		const recheckedSessions: Array<string | undefined> = [];
		const registries: AtomRegistry.AtomRegistry[] = [];
		const view = yield* screen.open(
			<App
				connected={(registry) => registries.push(registry)}
				rechecked={() => {
					counts.rechecks += 1;
					recheckedSessions.push(host.state.session);
				}}
				session={() => host.state.session}
				signIn={() => {
					host.state.session = "alice";
				}}
				url={host.url}
			/>,
		);
		return { counts, host, recheckedSessions, registries, screen, view };
	},
	inspect: ({ counts, host, view }) => ({ ...counts, ...host.state, html: view.container.innerHTML }),
	name: "live session",
	stages: ["screen"],
	verbs: ({ counts, host, recheckedSessions, registries, screen, view }, story) => {
		screen.tell = story.tell;
		return {
			active: () => host.state.active.length,
			lookups: () => host.state.lookups,
			observe: (line: string, check: () => void) => screen.observe(line, check),
			reads: () => host.state.reads,
			ready: () => view.container.querySelector('[data-live="live"][data-pending="false"]') !== null,
			recheckedSessions: () => [...recheckedSessions],
			rechecks: () => counts.rechecks,
			registries: () => registries,
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
