import { Effect, Fiber, Match, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
import { answered } from "#test/answers.ts";
import { records } from "#test/derivedReadsContract.ts";
import { configured, derivedDatabase } from "#test/derivedReadsData.ts";
import type { Delivery } from "#test/evolvingReadsContract.ts";
import { evolvingReadsEngine } from "#test/evolvingReadsEngine.ts";
import { type Mark, markQuery, reRead } from "#test/reRead.ts";
import { settled } from "#test/settled.ts";

const renderDelivery = Match.type<QueryUpdate>().pipe(
	Match.tagsExhaustive({
		QueryReadDenied: () => ["timeline read denied"],
		Result: ({ query, value }) => (query === "barrier" ? [] : [`${query}: ${JSON.stringify(value)}`]),
		Unchanged: ({ queryIndex }) => (queryIndex === 2 ? [] : ["pushed timeline unchanged"]),
	}),
);

export const evolvingReadsStory = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	*create() {
		const engine = yield* evolvingReadsEngine;
		const marked: { mark: Mark | undefined } = { mark: undefined };
		return { ...engine, ...marked, view: engine.api.timeline.query({ scope: "alice" }) };
	},
	inspect: ({ registrations }) => ({ registrations: [...registrations] }),
	layer: derivedDatabase,
	name: "evolving timeline dependencies over PostgreSQL and WebSocket",
	runIf: configured,
	stages: ["view"],
	verbs: (engine, story) => ({
		addRecord: (listId: number, id: number, body: string) => {
			story.tell(`a writer adds record ${id} to list ${listId}`);
			return engine.rpc("evolving.addRecord", { body, id, listId });
		},
		create: (id: number, body: string) => {
			story.tell(`alice creates list ${id} with its first record ${body}`);
			return engine.rpc("evolving.create", { body, id, scope: "alice" });
		},
		delivered: () => Effect.map(SubscriptionRef.get(engine.updates), (all) => all.flatMap(renderDelivery)),
		edit: (id: number, body: string) => {
			story.tell(`a writer commits record ${id} as ${body}`);
			return engine.rpc("evolving.edit", { body, id });
		},
		failDiscovery: () => {
			story.tell("the subscription's list relation becomes unavailable");
			return engine.sql`drop table lists cascade`;
		},
		joinEmptyList: (id: number) => {
			story.tell(`alice joins empty list ${id}`);
			engine.mark = markQuery(engine.registry, engine.view);
			return engine.rpc("evolving.join", { id, scope: "alice" });
		},
		leave: (id: number) => {
			story.tell(`alice leaves list ${id}`);
			return engine.rpc("evolving.leave", { id, scope: "alice" });
		},
		refreshed: () => reRead(engine.registry, engine.view, engine.mark),
		registered: (id: number) => Effect.sync(() => (engine.registrations.get(readKeys([records.bucket.listId(id)])[0]) ?? 0) > 0),
		shown: () => Effect.flatMap(settled(engine.registry, engine.view), () => AtomRegistry.getResult(engine.registry, engine.view)),
		subscriptionEnd: () => answered(Fiber.join(engine.finished), () => "completed"),
		untilBarrier: (body: string) =>
			until(
				SubscriptionRef.changes(engine.updates),
				(all) =>
					all.some((update) => update._tag === "Result" && update.query === "barrier" && Array.isArray(update.value) && update.value.includes(body)),
				{ name: `socket barrier sees ${body}` },
			),
		untilShown: (body: string) =>
			until(AtomRegistry.toStreamResult(engine.registry, engine.view), (rows) => rows.includes(body), { name: `timeline shows ${body}` }),
		untilTimeline: (rows: readonly string[]) =>
			until(
				SubscriptionRef.changes(engine.updates),
				(all) => {
					const result = all.findLastIndex(
						(update) => update._tag === "Result" && update.query === "pushed" && JSON.stringify(update.value) === JSON.stringify(rows),
					);
					return (
						result >= 0
						&& all.some((update) => update._tag === "Result" && update.query === "timeline" && JSON.stringify(update.value) === JSON.stringify(rows))
					);
				},
				{ name: "both timelines receive their refresh" },
			),
	}),
});

export function watchingTimeline(delivery: Delivery) {
	return evolvingReadsStory.trait("view", `alice opens her ${delivery} timeline`, function* (engine) {
		engine.view = engine.api[delivery].query({ scope: "alice" });
		engine.registry.mount(engine.view);
		yield* settled(engine.registry, engine.view);
	});
}
