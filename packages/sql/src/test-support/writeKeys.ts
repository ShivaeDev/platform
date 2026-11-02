import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { makeCapture } from "@shivaedev/changes/capture.ts";
import { type Key, readKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ChangeObserver, invalidateOnCommit, transact } from "#transact.ts";
import { compositeLedger } from "./compositeLedger.ts";
import { onPostgres } from "./engines.ts";

export const writeKeys = storyKit({
	...onPostgres,
	create: () =>
		Effect.gen(function* () {
			const ledger = yield* compositeLedger;
			const capture = yield* makeCapture<unknown>();
			const reactivity = yield* Reactivity.Reactivity;
			const refreshed: string[] = [];
			return { capture, ledger, reactivity, refreshed };
		}),
	name: "repository record keys",
	stages: [],
	verbs: ({ ledger, capture, reactivity, refreshed }, story) => ({
		compositeLedger: () => ledger,
		insertEntry: (account: string, sequence: bigint) =>
			Effect.suspend(() => {
				story.tell(`the repository inserts the ${account} entry at sequence ${sequence}`);
				return ledger.entries.insert({ account, amount: "7", sequence }).pipe(Effect.provide(capture.layer(ChangeObserver)));
			}),
		invalidateEntry: (id: string) =>
			Effect.suspend(() => {
				story.tell(`a transaction manually invalidates ledger entry ${id}`);
				return invalidateOnCommit({ [ledger.tableName]: [id] }).pipe(transact({ onSqlError: (error) => error }));
			}),
		publishedKeys: () => Effect.map(capture.attempted, (batches) => [...new Set(batches.flat())]),
		refreshed: () => [...refreshed],
		watch: (label: string, keys: readonly Key[]) =>
			Effect.acquireRelease(
				Effect.sync(() => {
					story.tell(`${label} watches its record keys`);
					return reactivity.registerUnsafe(readKeys(keys), () => refreshed.push(label));
				}),
				(release) => Effect.sync(release),
			),
	}),
});
