import { Deferred, Effect, Exit, Match, Scope, Stream, SubscriptionRef } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
import { engine, type Hold, type Watch } from "#test/recorded-reads/engine.ts";
import { configured, database } from "#test/recorded-reads/fixture.ts";

function titles(value: unknown): string {
	return Array.isArray(value) ? value.map(String).join(", ") : String(value);
}

const delivery = Match.type<QueryUpdate>().pipe(
	Match.tagsExhaustive({
		QueryReadDenied: () => "read denied",
		Result: ({ value }) => titles(value),
		Unchanged: () => "unchanged",
	}),
);

function required<A>(value: A | undefined, missing: string): Effect.Effect<A> {
	return value === undefined ? Effect.die(missing) : Effect.succeed(value);
}

export const recordedReadsStory = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => engine,
	layer: database,
	name: "keys recorded during a live run over PostgreSQL and WebSocket",
	runIf: configured,
	stages: ["view"],
	verbs: (current, story) => {
		function shelf() {
			return required(current.shelf.current, "alice has not opened her shelf");
		}
		function hold() {
			return required(current.holds.armed, "no shelf run was held");
		}
		function delivered(watch: Watch) {
			return Effect.map(SubscriptionRef.get(watch.updates), (all) => all.map(delivery));
		}
		return {
			deliveries: () => Effect.flatMap(shelf(), delivered),
			disconnect: () => {
				story.tell("alice's connection drops, closing her shelf subscription");
				return Effect.flatMap(shelf(), (watch) => Scope.close(watch.connection, Exit.void));
			},
			edit: (id: number, title: string) => {
				story.tell(`a writer commits book ${id} as ${title}`);
				return current.catalog.rpc("shelves.edit", { id, title });
			},
			holdNextShelfRun: () => {
				story.tell("alice's next shelf run will pause after its first statement and its recorded shelf key");
				return Effect.gen(function* () {
					const next: Hold = { reached: yield* Deferred.make<void>(), released: yield* Deferred.make<void>() };
					current.holds.armed = next;
					current.holds.next = next;
				});
			},
			move: (shelfId: number) => {
				story.tell(`alice moves to shelf ${shelfId}`);
				return current.catalog.rpc("shelves.move", { reader: "alice", shelf: shelfId });
			},
			openShelf: () => {
				story.tell("alice opens her shelf on a new connection");
				return Effect.map(current.connect("shelf"), (watch) => {
					current.shelf.current = watch;
				});
			},
			release: () => {
				story.tell("alice's paused shelf run sends its second statement");
				return Effect.flatMap(hold(), (held) => Deferred.succeed(held.released, undefined));
			},
			untilHostHeard: (title: string) =>
				until(
					SubscriptionRef.changes(current.catalog.updates),
					(all) => all.some((update) => update._tag === "Result" && Array.isArray(update.value) && update.value.includes(title)),
					{ name: `the host has dispatched the commit, as the catalog on another connection shows ${title}` },
				),
			untilShelfDeliveries: (count: number) =>
				Effect.flatMap(shelf(), (watch) =>
					until(SubscriptionRef.changes(watch.updates), (all) => all.length >= count, { name: `${count} shelf deliveries` }).pipe(
						Effect.andThen(delivered(watch)),
					),
				),
			untilShelfPaused: () =>
				Effect.flatMap(hold(), (held) =>
					until(Stream.fromEffect(Deferred.await(held.reached)), () => true, { name: "alice's shelf run paused between its statements" }),
				),
		};
	},
});

const shelfShown = Effect.fnUntraced(function* (current: Effect.Success<typeof engine>) {
	const watch = yield* current.connect("shelf");
	current.shelf.current = watch;
	yield* until(SubscriptionRef.changes(watch.updates), (all) => all.length > 0, { name: "alice's shelf shows its first result" });
	return watch;
});

export const watchingShelf = recordedReadsStory.trait("view", "alice watches her shelf", (current) => shelfShown(current));

export const reconnecting = recordedReadsStory.trait("view", "alice watched her shelf until her connection dropped", (current) =>
	Effect.flatMap(shelfShown(current), (watch) => Scope.close(watch.connection, Exit.void)),
);
