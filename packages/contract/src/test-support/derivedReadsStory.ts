import { Effect, Ref } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { answered } from "#test/answers.ts";
import { watchHints } from "#testing.ts";
import { derivedDatabase, derivedReadsEngine } from "./derivedReadsEngine.ts";

export const derivedReadsStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => derivedReadsEngine,
	layer: derivedDatabase,
	name: "server-derived timeline reads",
	runIf: postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL").configured,
	stages: ["adapter", "data", "view"],
	verbs: ({ client, query, registry, sql }, story) => ({
		create: (scope: string, id: number, body: string) => {
			story.tell(`a writer creates a new list and its first record in ${scope}`);
			return client("timelines.create", { body, id, scope });
		},
		edit: (id: number, body: string) => {
			story.tell(`a writer commits record ${id} as ${body}`);
			return client("timelines.edit", { body, id });
		},
		failDiscovery: () => {
			story.tell("the server cannot load the lists for a subscription");
			return sql`drop table lists cascade`;
		},
		shown: () => AtomRegistry.getResult(registry, query, { suspendOnWaiting: true }),
		subscribe: (...scopes: readonly string[]) => {
			story.tell(`alice subscribes to the scopes ${scopes.join(", ")}`);
			return answered(
				watchHints(client("timelines.$changes", { queries: scopes.map((scope) => ({ payload: { scope }, query: "timeline" })) })),
				() => "subscribed",
			);
		},
		waitForBody: (body: string) =>
			until(Atom.toStream(query), (result) => result._tag === "Success" && result.value.includes(body), { name: "refreshed timeline" }).pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
				Effect.asVoid,
			),
	}),
});

export const viewingTimeline = derivedReadsStory.trait("view", "alice watches her timeline using only her scope id", function* ({ query, registry }) {
	registry.mount(query);
	yield* AtomRegistry.getResult(registry, query, { suspendOnWaiting: true });
});

export const emptyTimeline = derivedReadsStory.trait("data", "alice has no lists yet", function* ({ sql }) {
	yield* sql`delete from records where list_id in (select id from lists where scope = 'alice')`;
	yield* sql`delete from lists where scope = 'alice'`;
});

export const projectedKeys = derivedReadsStory.trait("adapter", "the native adapter projects authorized keys with queryKeys", ({ projectKeys }) =>
	Ref.set(projectKeys, true),
);
