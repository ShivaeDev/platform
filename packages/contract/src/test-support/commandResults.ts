import { Effect, SubscriptionRef } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { engine } from "#test/command-results/engine.ts";
import { configured, database } from "#test/command-results/fixture.ts";

export const commandResults = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => engine,
	layer: database,
	name: "server-only command result keys over PostgreSQL and HTTP",
	runIf: configured,
	stages: [],
	verbs: (current, story) => ({
		list: (viewer: keyof typeof current.viewers) => current.viewers[viewer].client("pots.list", undefined),
		move: (id = 1) => {
			story.tell(`move pot ${id} to carol's household through HTTP RPC`);
			return current.viewers.alice.client("pots.move", { household: "new", id, reject: false });
		},
		nextHint: (viewer: keyof typeof current.viewers) =>
			until(SubscriptionRef.changes(current.viewers[viewer].hints.hints), (updates) => updates.length > 1, { name: "pushed pot list" }).pipe(
				Effect.as(true),
			),
		publications: () => current.publications,
		rejectMove: () => {
			story.tell("reject the move after looking up and contributing its audience keys");
			return current.viewers.alice.client("pots.move", { household: "new", id: 1, reject: true }).pipe(
				Effect.as("moved"),
				Effect.catchTag("Conflict", (error) => Effect.succeed(error.message)),
			);
		},
	}),
});
