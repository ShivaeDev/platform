import { Deferred, Effect, Queue } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { shown } from "#test/answers.ts";
import { commandFlights } from "#test/commandFlights.ts";
import { engine } from "#test/reflected-postgres/engine.ts";
import { configured, database } from "#test/reflected-postgres/fixture.ts";
import { settled } from "#test/settled.ts";

export const reflectedPostgres = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => engine,
	layer: database,
	name: "commands reflected in live queries over PostgreSQL and two hosts",
	runIf: configured,
	stages: ["view"],
	verbs: (current, story) => {
		const { reads, registry, tab } = current;
		const flights = commandFlights(current, story.tell);
		return {
			activity: flights.activity,
			add: (...titles: readonly string[]) =>
				flights.complete(`the tab adds ${titles.join(" and ")}, each in its own transaction`, tab.api.add.run({ reject: false, titles })),
			addRefused: (title: string) =>
				flights.complete(`the tab adds ${title} in a transaction that rolls back`, tab.api.add.run({ reject: true, titles: [title] })),
			beginStamp: (title: string) => flights.begin(`the tab starts stamping ${title}`, tab.api.stamp.run({ title })),
			beginSync: () => flights.begin("the tab starts a sync", tab.sync),
			finished: flights.finished,
			holdReads: () =>
				Effect.gen(function* () {
					story.tell("the tab's host holds every read of the list");
					reads.held = yield* Deferred.make<void>();
					yield* Queue.clear(reads.reached);
				}),
			otherHostAdds: (title: string) => {
				story.tell(`a client of the other host adds ${title}`);
				return current.writer("entries.add", { reject: false, titles: [title] });
			},
			releaseReads: () =>
				Effect.suspend(() => {
					story.tell("the tab's host answers its held reads");
					const held = reads.held;
					reads.held = undefined;
					return held === undefined ? Effect.void : Deferred.succeed(held, undefined);
				}),
			shown: () => Effect.sync(() => shown(registry.get(current.view), (titles) => titles.join(", "))),
			signals: flights.signals,
			touch: () => flights.complete("the tab sends a command that changes nothing", tab.api.touch.run()),
			untilAccepted: flights.untilAccepted,
			untilReadBegins: () => Queue.take(reads.reached),
		};
	},
});

export function watching() {
	return reflectedPostgres.trait("view", "the tab shows the list", function* (current) {
		current.registry.mount(current.view);
		yield* settled(current.registry, current.view);
	});
}
