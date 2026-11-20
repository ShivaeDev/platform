import { Deferred, type Duration, Effect, type Layer, Queue } from "effect";
import { STORED_WRITE_WINDOW } from "@shivaedev/contract/adapters/queryPersistence.ts";
import type { QueryStorageProvider, StoredQuery } from "@shivaedev/contract/QueryStorage.ts";
import type { QueryRetentionOptions } from "@shivaedev/contract/queryRetention.ts";
import { QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { loadQuery } from "#adapters/loadQuery.ts";
import { HAND_OVER_WINDOW } from "#adapters/queryHandoff.ts";
import { App, type Controls } from "#test/recent-queries/App.tsx";
import { memoryStorage } from "#test/recent-queries/memoryStorage.ts";
import { openClient } from "#test/recent-queries/openClient.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";

function refusal(kind: "NotFound" | "QueryReadDenied") {
	return kind === "NotFound" ? new NotFound({ message: "Note not found" }) : new QueryReadDenied({ message: "Note withheld" });
}
function storedTitle(value: string) {
	const parsed: unknown = JSON.parse(value);
	return typeof parsed === "string" ? parsed : "a secret";
}
function storedTitles(entries: ReadonlyMap<string, StoredQuery>) {
	return [...entries.values()].map(({ value }) => storedTitle(value));
}

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
		const warmIds: string[] = [];
		const device: { persist?: Layer.Layer<QueryStorageProvider>; reloads: number; stored?: ReturnType<typeof memoryStorage>["users"] } = {
			reloads: 0,
		};
		return { controls, device, host, loader, retention, run, screen, view, warmIds };
	},
	inspect: ({ host, view }) => ({ reads: host.reads, screen: view.container.innerHTML }),
	name: "recent query screens",
	stages: ["policy", "warm", "device", "screen"],
	verbs: ({ controls, device, host, loader, retention, run, screen, view, warmIds }, story) => {
		screen.tell = story.tell;
		function settled() {
			return settleScreen(view.container, () => view.container.querySelector('[data-pending="true"]') !== null, story.tell);
		}
		function shownId() {
			return view.container.querySelector("output")?.dataset.id;
		}
		return {
			answer: (title: string) =>
				screen
					.act(`the subscription answers ${title}`, async () => {
						await run(Effect.flatMap(Queue.take(host.requests), (reply) => Deferred.succeed(reply, title)));
						await loader.done;
					})
					.pipe(Effect.andThen(settled())),
			firstShown: () => Effect.sync(() => view.container.querySelector("output")?.dataset.first),
			handOverWindowPasses: () => {
				story.tell(`the loader's ${HAND_OVER_WINDOW} hand-over window passes without a reader`);
				return untilTimer(HAND_OVER_WINDOW).pipe(Effect.andThen(passes(HAND_OVER_WINDOW, Queue.take(host.closed))));
			},
			leave: () => {
				const kept = warmIds.includes(shownId() ?? "");
				return screen
					.act(`leave the note screen${kept ? ", whose note stays warm" : ""}`, () => {
						if (controls.show === undefined) {
							throw new Error("No signed-in screen");
						}
						controls.show(undefined);
					})
					.pipe(Effect.andThen(kept ? Effect.void : Queue.take(host.closed)));
			},
			open: (id = "one") =>
				screen.act(`open note ${id}`, () => {
					if (controls.show === undefined) {
						throw new Error("No signed-in screen");
					}
					controls.show(id);
				}),
			openRoute: (id = "one") =>
				screen.act(`open a fresh route match for note ${id}`, () => {
					if (controls.route === undefined) {
						throw new Error("No signed-in screen");
					}
					controls.route(id);
				}),
			pageHides: () =>
				screen.act("the page hides", () => {
					Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
					document.dispatchEvent(new Event("visibilitychange"));
					Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
				}),
			pass: (duration: Duration.Input) => screen.act(`${duration} passes on the story clock`, () => run(passes(duration, Effect.void))),
			reads: () => Effect.sync(() => [...host.reads]),
			refuse: (kind: "NotFound" | "QueryReadDenied") =>
				screen
					.act(`the subscription refuses the note with ${kind}`, () =>
						run(Effect.flatMap(Queue.take(host.requests), (reply) => Deferred.fail(reply, refusal(kind)))),
					)
					.pipe(Effect.andThen(settled())),
			reload: () => {
				device.reloads += 1;
				return screen.act("the page reloads", () =>
					view.render(
						<App client={host.client} controls={controls} key={device.reloads} persist={device.persist} retention={retention} warm={warmIds} />,
					),
				);
			},
			replaceWarm: (previous: string, next: string) =>
				screen
					.act(`the warm list names note ${next} in place of note ${previous}`, () => {
						if (controls.warm === undefined) {
							throw new Error("No signed-in session");
						}
						warmIds.splice(warmIds.indexOf(previous), 1, next);
						controls.warm([...warmIds]);
					})
					.pipe(Effect.andThen(Queue.take(host.closed))),
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
			signOut: () =>
				screen
					.act("alice signs out", () => {
						if (controls.session === undefined) {
							throw new Error("No session owner");
						}
						controls.session(undefined);
					})
					.pipe(Effect.andThen(Queue.take(host.closed))),
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
			stored: () => Effect.sync(() => Object.fromEntries([...(device.stored ?? [])].map(([user, entries]) => [user, storedTitles(entries)]))),
			subscriptions: () => Effect.sync(() => host.subscriptions.open),
			untilRetained: () => untilTimer(retention.timeToLive ?? "5 minutes"),
			writeWindowPasses: () =>
				untilTimer(STORED_WRITE_WINDOW).pipe(
					Effect.andThen(screen.act(`the ${STORED_WRITE_WINDOW} write window passes`, () => run(passes(STORED_WRITE_WINDOW, Effect.void)))),
				),
		};
	},
});

export function policy(options: QueryRetentionOptions) {
	return recentQueries.trait("policy", `query retention is ${JSON.stringify(options)}`, ({ retention }) =>
		Effect.sync(() => Object.assign(retention, options)),
	);
}
export function warm(...ids: readonly string[]) {
	return recentQueries.trait("warm", `the session keeps note ${ids.join(" and ")} warm`, ({ warmIds }) => Effect.sync(() => warmIds.push(...ids)));
}
export function storedOnDevice(...entries: readonly (readonly [user: string, id: string, title: unknown])[]) {
	return recentQueries.trait(
		"device",
		entries.length === 0
			? "stored query results are on"
			: `the device holds ${entries.map(([user, id, title]) => `${user}'s note ${id}, ${JSON.stringify(title)}`).join(" and ")}`,
		({ device }) =>
			Effect.sync(() => {
				const memory = memoryStorage();
				for (const [user, id, title] of entries) {
					const key = JSON.stringify(["recentNotes.get", JSON.stringify({ id }), null]);
					memory.users.set(user, new Map([...(memory.users.get(user) ?? []), [key, { key, used: 1, value: JSON.stringify(title) }]]));
				}
				device.persist = memory.layer;
				device.stored = memory.users;
			}),
	);
}
export const persisted = storedOnDevice();
export const signedIn = recentQueries.trait("screen", "alice is signed in at Home", ({ controls, device, host, retention, view, warmIds }) =>
	Effect.promise(() => view.render(<App client={host.client} controls={controls} persist={device.persist} retention={retention} warm={warmIds} />)),
);
export const signedOutAnswer = recentQueries.trait(
	"screen",
	"the session check answers signed out",
	({ controls, device, host, retention, view, warmIds }) =>
		Effect.promise(() =>
			view.render(<App client={host.client} controls={controls} persist={device.persist} retention={retention} signedIn={null} warm={warmIds} />),
		),
);
