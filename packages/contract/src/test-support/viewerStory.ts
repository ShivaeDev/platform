import { Effect, Option, Ref, Schema, Stream, SubscriptionRef } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { type HintViewer, watchHints } from "@shivaedev/test-kits/contract/testing.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { answered, shown, times, updateWords } from "./answers.ts";
import { type Mark, markQuery, reRead } from "./reRead.ts";
import { settled } from "./settled.ts";
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
	"their notes titled One": { payload: { title: "One" }, query: "list" },
} as const satisfies Record<string, QueryReferences[number]>;
type ViewerQuery = keyof typeof QUERIES;

const viewerStoryEngine = Effect.map(viewerEngine, (fixture) => ({
	...fixture,
	listeners: new Map<Viewer, HintViewer<unknown>>(),
	marked: new Map<Viewer, Mark>(),
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
	clock: "test",
	create: () => viewerStoryEngine,
	inspect: (engine) => ({ reads: Effect.runSync(SubscriptionRef.get(engine.reads)), stored: [...Effect.runSync(Ref.get(engine.stored)).values()] }),
	name: "viewer-scoped hints",
	stages: ["pages", "listeners"],
	verbs: (engine, story) => ({
		announce: (viewer: Viewer, id: number) =>
			Effect.gen(function* () {
				story.tell(`the server announces a change to note ${id} in ${viewer}'s session and rechecks the read policy before delivering it`);
				const before = yield* SubscriptionRef.get(engine.checks);
				yield* engine.reactivity.invalidate(invalidationKeys([notes.item(id)]));
				yield* until(SubscriptionRef.changes(engine.checks), (count) => count > before, { name: "policy check" });
			}),
		changesHeard: (viewer: Viewer) =>
			Effect.map(SubscriptionRef.get(listenerOf(engine, viewer).hints), (hints) => hints.filter((hint) => hint._tag === "Result").map(updateWords)),
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
		noteTitle: (viewer: Viewer, id: number) =>
			Effect.map(SubscriptionRef.get(listenerOf(engine, viewer).hints), (updates) => {
				const result = updates.findLast((update) => update._tag === "Result" && Schema.is(Row)(update.value) && update.value.id === id);
				return result?._tag === "Result" && Schema.is(Row)(result.value) ? result.value.title : undefined;
			}),
		pageReads: (viewer: Viewer) =>
			Effect.andThen(
				shownOf(engine, viewer),
				Effect.map(SubscriptionRef.get(engine.reads), (reads) => `read ${times(readsBy(reads, viewer))}`),
			),
		rename: (viewer: Viewer, id: number, title: string) => {
			story.tell(`${viewer} renames note ${id} to ${title}`);
			for (const [owner, page] of engine.pages) {
				engine.marked.set(owner, markQuery(page.registry, page.query));
			}
			return answered(engine.client("notes.rename", { id, title }, { headers: { viewer } }), () => "renamed");
		},
		shown: (viewer: Viewer) => shownOf(engine, viewer),
		subscribe: (viewer: Viewer, ...queries: readonly ViewerQuery[]) => {
			story.tell(`${viewer} subscribes to changes of ${queries.join(" and ")}`);
			return answered(Stream.runHead(changes(engine, viewer, queries)), (first) => (Option.isSome(first) ? "subscribed" : "ended at once"));
		},
		subscriptionDenial: (viewer: Viewer) =>
			Effect.map(
				until(SubscriptionRef.changes(listenerOf(engine, viewer).hints), (hints) => hints.some((hint) => hint._tag === "QueryReadDenied"), {
					name: "policy denial",
				}),
				() => "read denied",
			),
		untilNoteTitle: (viewer: Viewer, id: number, title: string) =>
			until(
				SubscriptionRef.changes(listenerOf(engine, viewer).hints),
				(updates) =>
					updates.some(
						(update) => update._tag === "Result" && Schema.is(Row)(update.value) && update.value.id === id && update.value.title === title,
					),
				{ name: "authorized note delivery" },
			),
		untilPageReRead: (viewer: Viewer) =>
			Effect.gen(function* () {
				story.tell(`${viewer}'s page re-reads its notes and shows the new value`);
				const { query, registry } = pageOf(engine, viewer);
				yield* reRead(registry, query, engine.marked.get(viewer));
			}),
	}),
});

export function listening(viewer: Viewer, ...queries: readonly ViewerQuery[]) {
	return viewerStory.trait("listeners", `${viewer} listens for changes of ${queries.join(" and ")} and has received its initial result`, (engine) =>
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
