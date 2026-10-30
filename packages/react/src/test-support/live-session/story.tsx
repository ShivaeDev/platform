import { setTimeout } from "node:timers/promises";
import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clickButton, Screen } from "#test/Screen.ts";
import { App } from "./App.tsx";
import type { connect } from "./connect.ts";
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
		const clients: ReturnType<typeof connect>[] = [];
		const view = yield* screen.open(
			<App
				connected={(registry, client) => {
					registries.push(registry);
					clients.push(client);
				}}
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
		return { clients, counts, host, recheckedSessions, registries, screen, view };
	},
	inspect: ({ counts, host, view }) => ({ ...counts, ...host.state, html: view.container.innerHTML }),
	name: "live session",
	stages: ["screen"],
	verbs: ({ clients, counts, host, recheckedSessions, registries, screen, view }, story) => {
		screen.tell = story.tell;
		function query() {
			const registry = registries.at(-1);
			const client = clients.at(-1);
			if (registry === undefined || client === undefined) {
				throw new Error("No open note");
			}
			return { atom: client.get.query(undefined), registry };
		}
		return {
			active: () => host.state.active.length,
			denyRead: () =>
				screen.act("Alice loses read access while her screen stays open", () => {
					host.state.allowed = false;
				}),
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
			subscribers: () => [...host.state.active],
			text: () => view.container.textContent,
			untilQueryFails: () =>
				screen.act("the open note's query fails", () => {
					const { atom, registry } = query();
					return Effect.runPromise(AtomRegistry.toStream(registry, atom).pipe(Stream.filter(AsyncResult.isFailure), Stream.runHead));
				}),
			untilQueryReady: () =>
				screen.act("the open note's query finishes", () => {
					const { atom, registry } = query();
					return Effect.runPromise(AtomRegistry.getResult(registry, atom));
				}),
			wait: (millis: number) => screen.act(`wait ${millis} milliseconds`, () => setTimeout(millis)),
		};
	},
});
