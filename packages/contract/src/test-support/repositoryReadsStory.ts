import { Effect, SubscriptionRef } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
import { engine, type View, type Watched } from "#test/repository-reads/engine.ts";
import { configured, database, type Handlers } from "#test/repository-reads/fixture.ts";

function shown(value: unknown): string {
	return Array.isArray(value) ? value.map(String).join(" | ") : String(value);
}

function words(watch: Watched, update: QueryUpdate): string {
	switch (update._tag) {
		case "Result":
			return `${watch.views[update.queryIndex] ?? update.query}: ${shown(update.value)}`;
		case "Unchanged":
			return `${watch.views[update.queryIndex] ?? "an unknown query"} unchanged`;
		case "QueryReadDenied":
			return "read denied";
	}
}

export const repositoryReadsStory = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => engine,
	layer: database,
	name: "live queries built from repository and raw SQL reads over PostgreSQL",
	runIf: configured,
	stages: ["view"],
	verbs: (current, story) => {
		function watched() {
			return current.watched.current === undefined ? Effect.die("nothing is watched yet") : Effect.succeed(current.watched.current);
		}
		let loansMade = 0;
		let entriesWritten = 0;
		return {
			lend: (book: number, reader: string) => {
				story.tell(`a writer lends book ${book} to ${reader}`);
				loansMade += 1;
				return current.client("library.lend", { book, id: 100 + loansMade, reader });
			},
			loggedWarnings: () => Effect.sync(current.warnings),
			move: (shelf: number) => {
				story.tell(`alice moves to shelf ${shelf}`);
				return current.client("library.move", { reader: "alice", shelf });
			},
			registrationsOfBook: (id: number) => Effect.sync(() => current.registrations.filter((keys) => keys.includes(`library_books:${id}`))),
			retitle: (id: number, title: string) => {
				story.tell(`a writer retitles book ${id} as ${title}`);
				return current.client("library.retitle", { id, title });
			},
			untilDeliveries: (count: number) =>
				Effect.flatMap(watched(), (watch) =>
					until(SubscriptionRef.changes(watch.updates), (all) => all.length >= count, { name: `${count} deliveries` }).pipe(
						Effect.map((all) => all.map((update) => words(watch, update))),
					),
				),
			writesInDiary: (owner: string, day: number, note: string) => {
				story.tell(`${owner} writes ${note} in the diary for day ${day}`);
				entriesWritten += 1;
				return current.client("library.writeDiary", { day, id: 100 + entriesWritten, note, ownerId: owner });
			},
		};
	},
});

export function watching(views: readonly View[], style: Handlers = "module handlers") {
	return repositoryReadsStory.trait(
		"view",
		`alice watches ${views.join(" and ")} in one subscription served by ${style}, which delivered their first results`,
		(current) =>
			Effect.gen(function* () {
				const updates = yield* current.watch(views, style);
				yield* until(SubscriptionRef.changes(updates), (all) => all.length >= views.length, { name: "first results" });
			}),
	);
}
