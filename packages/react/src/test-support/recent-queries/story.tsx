import { Deferred, type Duration, Effect, Queue } from "effect";
import type { QueryRetentionOptions } from "@shivaedev/contract/queryRetention.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { loadQuery } from "#adapters/loadQuery.ts";
import { HAND_OVER_WINDOW } from "#adapters/queryHandoff.ts";
import { App, type Controls } from "#test/recent-queries/App.tsx";
import { openClient } from "#test/recent-queries/openClient.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";

export const recentQueries = storyKit({
	clock: "test",
	*create() {
		const host = yield* openClient;
		const controls: Controls = {};
		const retention: QueryRetentionOptions = {};
		const screen = new Screen(() => undefined);
		const view = yield* screen.open();
		const run = Effect.runPromiseWith(yield* Effect.context());
		const loader = { done: Promise.resolve() };
		return { controls, host, loader, retention, run, screen, view };
	},
	inspect: ({ host, view }) => ({ reads: host.reads, screen: view.container.innerHTML }),
	name: "recent query screens",
	stages: ["policy", "screen"],
	verbs: ({ controls, host, loader, retention, run, screen, view }, story) => {
		screen.tell = story.tell;
		return {
			answer: (title: string) =>
				screen
					.act(`the subscription answers ${title}`, async () => {
						await run(Effect.flatMap(Queue.take(host.requests), (reply) => Deferred.succeed(reply, title)));
						await loader.done;
					})
					.pipe(Effect.andThen(settleScreen(view.container, () => view.container.querySelector('[data-pending="true"]') !== null, story.tell))),
			handOverWindowPasses: () => {
				story.tell(`the loader's ${HAND_OVER_WINDOW} hand-over window passes without a reader`);
				return untilTimer(HAND_OVER_WINDOW).pipe(Effect.andThen(passes(HAND_OVER_WINDOW, Queue.take(host.closed))));
			},
			leave: () =>
				screen
					.act("leave the note screen", () => {
						if (controls.show === undefined) {
							throw new Error("No signed-in screen");
						}
						controls.show(undefined);
					})
					.pipe(Effect.andThen(Queue.take(host.closed))),
			open: (id = "one") =>
				screen.act(`open note ${id}`, () => {
					if (controls.show === undefined) {
						throw new Error("No signed-in screen");
					}
					controls.show(id);
				}),
			pass: (duration: Duration.Input) => screen.act(`${duration} passes on the story clock`, () => run(passes(duration, Effect.void))),
			reads: () => Effect.sync(() => [...host.reads]),
			session: (user: string | undefined) =>
				screen.act(`the auth owner changes to ${user ?? "signed out"}`, () => {
					if (controls.session === undefined) {
						throw new Error("No session owner");
					}
					controls.session(user);
				}),
			shown: () =>
				Effect.sync(() => ({
					stale: view.container.querySelector("output")?.dataset.stale === "true",
					title: view.container.querySelector("output")?.textContent ?? view.container.textContent,
				})),
			startLoader: (id = "one") =>
				Effect.sync(() => {
					story.tell(`the route loader reads note ${id}`);
					if (controls.registry === undefined) {
						throw new Error("No session registry");
					}
					loader.done = loadQuery(controls.registry, host.client.api.get.query({ id }), { abortController: new AbortController() }).then(
						() => undefined,
					);
				}),
			untilRetained: () => untilTimer(retention.timeToLive ?? "5 minutes"),
		};
	},
});

export function policy(options: QueryRetentionOptions) {
	return recentQueries.trait("policy", `query retention is ${JSON.stringify(options)}`, ({ retention }) =>
		Effect.sync(() => Object.assign(retention, options)),
	);
}
export const signedIn = recentQueries.trait("screen", "alice is signed in at Home", ({ controls, host, retention, view }) =>
	Effect.promise(() => view.render(<App client={host.client} controls={controls} retention={retention} />)),
);
