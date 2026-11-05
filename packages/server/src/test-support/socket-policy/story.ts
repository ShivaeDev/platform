import { Effect, Stream } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { type Feed, followHints } from "#test/rpc/followHints.ts";
import { openHost } from "./openHost.ts";

export const socketPolicyStory = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	*create() {
		const host = yield* openHost;
		return { ...host, admin: yield* host.client("admin"), alice: yield* host.client("alice"), feeds: new Map<string, Feed>() };
	},
	layer: postgres,
	name: "hosted socket read policies",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: (engine, story) => {
		function reference(query: "timeline" | "all", owner = "alice") {
			return query === "timeline" ? { payload: { owner }, query } : { payload: undefined, query };
		}
		return {
			all: (caller: "alice" | "admin" = "admin") => answered(engine[caller]("socketNotes.all", undefined)),
			createList: (id: number, owner: string) => {
				story.tell(`alice creates list ${id} for ${owner}`);
				return engine.alice("socketNotes.createList", { id, owner });
			},
			nextHint: (query: string) => {
				const feed = engine.feeds.get(query);
				return feed === undefined ? Effect.die(`No subscription to ${query}`) : feed.next;
			},
			restoreAdmin: () =>
				Effect.sync(() => {
					engine.access.admin = true;
				}),
			revokeAdmin: () =>
				Effect.sync(() => {
					engine.access.admin = false;
				}),
			save: (id: number, listId: number, title: string) => {
				story.tell(`alice saves ${title} in list ${listId}`);
				return engine.alice("socketNotes.save", { id, listId, title });
			},
			subscribe: (caller: "alice" | "admin", query: "timeline" | "all") =>
				Effect.gen(function* () {
					story.tell(`${caller} subscribes to ${query} over the host's socket`);
					engine.feeds.set(query, yield* followHints(engine[caller]("socketNotes.$changes", { queries: [reference(query)] })));
				}),
			subscriptionRefusal: (query: "timeline" | "all", owner = "bob") =>
				answered(engine.alice("socketNotes.$changes", { queries: [reference(query, owner)] }).pipe(Stream.runCollect)),
			timeline: (owner = "alice") => answered(engine.alice("socketNotes.timeline", { owner })),
		};
	},
});
