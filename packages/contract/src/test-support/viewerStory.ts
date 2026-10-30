import { Effect, Fiber, Option, Ref, Stream, SubscriptionRef } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { TestClock } from "effect/testing";
import { invalidationKeys, type Key } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type HintViewer, heard, watchHints } from "#testing.ts";
import { answered, hintWords, shown, times } from "./answers.ts";
import { type Mark, reRead } from "./reRead.ts";
import { settled, signal } from "./settle.ts";
import { type Notes, notes, Row, viewerEngine } from "./viewerEngine.ts";
import { type ViewerPage, viewerPage } from "./viewerPage.ts";

type Viewer = "alice" | "bob";
type QueryReferences = Rpc.Payload<Rpc.ExtractTag<RpcGroup.Rpcs<typeof Notes>, "notes.$changes">>["queries"];

const QUERIES = {
	"alice's notes": { payload: { userId: "alice" }, query: "listFor" },
	"every note of theirs": { payload: { title: "" }, query: "list" },
	"note 1": { payload: { id: 1 }, query: "get" },
	"note 2": { payload: { id: 2 }, query: "get" },
	"note 3": { payload: { id: 3 }, query: "get" },
	"the unprotected notes": { payload: undefined, query: "unprotected" },
	"their notes titled One": { payload: { title: "One" }, query: "list" },
} as const satisfies Record<string, QueryReferences[number]>;
type ViewerQuery = keyof typeof QUERIES;

const viewerStoryEngine = Effect.map(viewerEngine, (fixture) => ({
	...fixture,
	listeners: new Map<Viewer, HintViewer<unknown>>(),
	marked: new Map<Viewer, Mark<readonly Row[], unknown>>(),
	pages: new Map<Viewer, ViewerPage>(),
}));
type ViewerEngine = Effect.Success<typeof viewerStoryEngine>;

function changes(engine: ViewerEngine, viewer: Viewer, queries: readonly ViewerQuery[]) {
	return engine.client("notes.$changes", { queries: queries.map((name) => QUERIES[name]) }, { headers: { viewer } });
}

function listenerOf(engine: ViewerEngine, viewer: Viewer) {
	const listener = engine.listeners.get(viewer);
	if (listener === undefined) {
		throw new Error(`${viewer} is not listening`);
	}
	return listener;
}

function pageOf(engine: ViewerEngine, viewer: Viewer) {
	const page = engine.pages.get(viewer);
	if (page === undefined) {
		throw new Error(`${viewer} has no open page`);
	}
	return page;
}

function readsBy(reads: readonly string[], viewer: Viewer) {
	return reads.filter((read) => read === viewer).length;
}

function shownOf(engine: ViewerEngine, viewer: Viewer) {
	const { query, registry } = pageOf(engine, viewer);
	return Effect.map(settled(registry, query), (result) => shown(result, (rows) => rows.map((row) => row.title)));
}

export const viewerStory = storyKit({
	clock: "live",
	create: () => viewerStoryEngine,
	inspect: (engine) => ({ reads: Effect.runSync(SubscriptionRef.get(engine.reads)), stored: [...Effect.runSync(Ref.get(engine.stored)).values()] }),
	name: "viewer-scoped hints",
	stages: ["pages", "listeners"],
	verbs: (engine, story) => ({
		announce: (viewer: Viewer, id: number) =>
			Effect.gen(function* () {
				story.tell(`the server announces a change to note ${id} in ${viewer}'s session and rechecks the read policy before delivering it`);
				const before = yield* SubscriptionRef.get(engine.checks);
				yield* engine.reactivity.invalidate(invalidationKeys([notes.item(id)], { scope: viewer }));
				yield* signal(SubscriptionRef.changes(engine.checks), (count) => count > before);
			}),
		changesHeard: (viewer: Viewer) =>
			Effect.map(SubscriptionRef.get(listenerOf(engine, viewer).hints), (hints) => hints.filter((hint) => hint._tag === "Changed").map(hintWords)),
		get: (viewer: Viewer, id: number) => {
			story.tell(`${viewer} reads note ${id}`);
			return answered(engine.client("notes.get", { id }, { headers: { viewer } }), (row) => `note ${row.id} titled ${row.title}`);
		},
		handOver: (id: number, owner: Viewer) => {
			story.tell(`the server hands note ${id} to ${owner} without announcing it`);
			return Ref.update(engine.stored, (rows) => {
				const row = rows.get(id);
				return row === undefined ? rows : new Map([...rows, [id, new Row({ ...row, owner })]]);
			});
		},
		heard: (viewer: Viewer, keys: readonly Key[]) => Effect.map(heard(listenerOf(engine, viewer), keys), (found) => (found ? "heard" : "not heard")),
		heardWithinAnHour: (viewer: Viewer, keys: readonly Key[]) =>
			Effect.gen(function* () {
				story.tell(`${viewer} waits up to an hour of the story clock for the keys, and the hour passes`);
				const waiting = yield* heard(listenerOf(engine, viewer), keys, { within: "1 hour" }).pipe(Effect.forkScoped);
				yield* TestClock.adjust("1 hour");
				return (yield* Fiber.join(waiting)) ? "heard" : "not heard within the hour";
			}),
		pageReads: (viewer: Viewer) =>
			Effect.andThen(
				shownOf(engine, viewer),
				Effect.map(SubscriptionRef.get(engine.reads), (reads) => `read ${times(readsBy(reads, viewer))}`),
			),
		rename: (viewer: Viewer, id: number, title: string) => {
			story.tell(`${viewer} renames note ${id} to ${title}`);
			const reads = Effect.runSync(SubscriptionRef.get(engine.reads));
			for (const [owner, page] of engine.pages) {
				engine.marked.set(owner, { reads: readsBy(reads, owner), shown: page.registry.get(page.query) });
			}
			return answered(engine.client("notes.rename", { id, title }, { headers: { viewer } }), () => "renamed");
		},
		shown: (viewer: Viewer) => shownOf(engine, viewer),
		subscribe: (viewer: Viewer, ...queries: readonly ViewerQuery[]) => {
			story.tell(`${viewer} subscribes to changes of ${queries.join(" and ")}`);
			return answered(Stream.runHead(changes(engine, viewer, queries)), (first) => (Option.isSome(first) ? "subscribed" : "ended at once"));
		},
		subscriptionEnd: (viewer: Viewer) => answered(listenerOf(engine, viewer).finished, () => "completed"),
		untilChangeArrives: (viewer: Viewer, id: number) => {
			story.tell(`the change to note ${id} reaches ${viewer}`);
			return signal(SubscriptionRef.changes(listenerOf(engine, viewer).hints), (hints) =>
				hints.some((hint) => hint._tag === "Changed" && hint.keys.some((key) => key._tag === "Item" && key.id === id)),
			);
		},
		untilHintArrives: (viewer: Viewer) => {
			story.tell(`a changed hint reaches ${viewer}`);
			return signal(SubscriptionRef.changes(listenerOf(engine, viewer).hints), (hints) => hints.some((hint) => hint._tag === "Changed"));
		},
		untilPageReRead: (viewer: Viewer) =>
			Effect.gen(function* () {
				story.tell(`${viewer}'s page re-reads its notes and shows the new value`);
				const { query, registry } = pageOf(engine, viewer);
				yield* reRead(
					registry,
					query,
					Stream.map(SubscriptionRef.changes(engine.reads), (reads) => readsBy(reads, viewer)),
					engine.marked.get(viewer),
				);
			}),
	}),
});

export function listening(viewer: Viewer, ...queries: readonly ViewerQuery[]) {
	return viewerStory.trait("listeners", `${viewer} listens for changes of ${queries.join(" and ")} and has heard the first resync`, (engine) =>
		Effect.gen(function* () {
			engine.listeners.set(viewer, yield* watchHints(changes(engine, viewer, queries)));
		}),
	);
}

export function pageOpen(viewer: Viewer, title = "") {
	return viewerStory.trait("pages", `${viewer} has opened their notes page${title === "" ? "" : ` filtered to ${title}`}`, (engine) =>
		Effect.gen(function* () {
			engine.pages.set(viewer, yield* viewerPage(engine, viewer, { kind: "list", title }));
			yield* shownOf(engine, viewer);
		}),
	);
}

export function othersPageOpen(viewer: Viewer, owner: Viewer) {
	return viewerStory.trait("pages", `${viewer} has opened a page of ${owner}'s notes`, (engine) =>
		Effect.gen(function* () {
			engine.pages.set(viewer, yield* viewerPage(engine, viewer, { kind: "listFor", userId: owner }));
		}),
	);
}

export function unprotectedPageOpen(viewer: Viewer) {
	return viewerStory.trait("pages", `${viewer} has opened a page of the notes query that declares no read policy`, (engine) =>
		Effect.gen(function* () {
			engine.pages.set(viewer, yield* viewerPage(engine, viewer, { kind: "unprotected" }));
		}),
	);
}
