import { Effect } from "effect";
import type { Observation } from "@shivaedev/changes/observe.ts";
import { keyStory } from "@shivaedev/changes/test-support/keyStory.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ChangeObserver, invalidateOnCommit, transact } from "#transact.ts";
import { compositeLedger } from "./compositeLedger.ts";
import { onPostgres } from "./engines.ts";

function observe(publications: Set<unknown>) {
	return (event: Observation<unknown>) =>
		Effect.sync(() => {
			if (event._tag === "Published") {
				for (const key of event.changes) {
					publications.add(key);
				}
			}
		});
}

const repositoryKeys = storyKit({
	...onPostgres,
	create: () => Effect.map(compositeLedger, (ledger) => ({ ledger, publications: new Set<unknown>() })),
	name: "repository record keys",
	stages: [],
	verbs: ({ ledger, publications }, story) => ({
		compositeLedger: () => ledger,
		insertEntry: (account: string, sequence: bigint) =>
			Effect.suspend(() => {
				story.tell(`the repository inserts the ${account} entry at sequence ${sequence}`);
				return ledger.entries.insert({ account, amount: "7", sequence }).pipe(Effect.provideService(ChangeObserver, observe(publications)));
			}),
		invalidateEntry: (id: string) =>
			Effect.suspend(() => {
				story.tell(`a transaction manually invalidates ledger entry ${id}`);
				return invalidateOnCommit({ [ledger.tableName]: [id] }).pipe(transact({ onSqlError: (error) => error }));
			}),
		publishedKeys: () => [...publications],
	}),
});

export const writeKeys = storyKit({ extends: [repositoryKeys, keyStory], name: "SQL writes and record subscribers" });
