import { Effect } from "effect";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type ChangeKeysEngine, changeKeysEngine } from "./changeKeysEngine.ts";
import { changeKeysVerbs, ID_BEYOND_NUMBER } from "./changeKeysVerbs.ts";
import { compositeLedger } from "./compositeLedger.ts";
import { onPostgres } from "./engines.ts";
import { setupOwnedRows } from "./postgresOwnedRows.ts";

function inspect(engine: ChangeKeysEngine) {
	return { endings: engine.endings, published: [...engine.published], woken: engine.woken };
}

export const changeKeys = storyKit({
	...onPostgres,
	create: changeKeysEngine,
	inspect,
	name: "PostgreSQL change keys",
	stages: ["tables", "rows", "watchers"],
	verbs: (engine: ChangeKeysEngine, story: { readonly tell: (line: string) => void }) => changeKeysVerbs(engine, story.tell),
});

export function recordInList1() {
	return changeKeys.trait("rows", "record 1 is in list 1 for alice", ({ buckets }) =>
		Effect.asVoid(buckets.rows.insert({ listId: 1, owner: "alice", slug: "note" })),
	);
}

export function sourceRecordInList2() {
	return changeKeys.trait("rows", "a source table holds one record for list 2 and bob", ({ buckets }) =>
		Effect.asVoid(buckets.source.insert({ listId: 2, owner: "bob", slug: "copy" })),
	);
}

function watcher(label: string, keys: (engine: ChangeKeysEngine) => readonly string[]) {
	return changeKeys.trait("watchers", `${label} is watched`, function* (engine) {
		const stop = engine.reactivity.registerUnsafe(keys(engine), () => engine.woken.push(label));
		yield* Effect.addFinalizer(() => Effect.sync(stop));
	});
}

export function watchesList(id: number) {
	return watcher(`list ${id}`, ({ buckets }) => readKeys([buckets.keys.bucket.listId(id)]));
}

export function watchesOwner(owner: string) {
	return watcher(`owner ${owner}`, ({ buckets }) => readKeys([buckets.keys.bucket.owner(owner)]));
}

export function watchesRecord(id: number) {
	return watcher(`record ${id}`, ({ buckets }) => readKeys([buckets.keys.item(id)]));
}

export function ownedRowsTable() {
	return changeKeys.trait("tables", "an owned rows table keys each row by id and owner and versions it", function* (engine) {
		engine.owned = yield* setupOwnedRows;
	});
}

export function ownedDraft(id = 1) {
	return changeKeys.trait("rows", `owned row ${id}/2 is a draft`, function* ({ owned }) {
		if (owned === undefined) {
			return yield* Effect.die(new Error("Give the story the owned rows table first"));
		}
		yield* owned.rows.insert({ id, name: "Draft", ownerId: 2 });
	});
}

export function ledgerTable() {
	return changeKeys.trait("tables", "a ledger keys each entry by account and bigint sequence", function* (engine) {
		engine.ledger = yield* compositeLedger;
	});
}

export function cashEntry() {
	return changeKeys.trait("rows", "the ledger holds a cash entry at a sequence beyond Number precision", function* ({ ledger }) {
		if (ledger === undefined) {
			return yield* Effect.die(new Error("Give the story the ledger table first"));
		}
		yield* ledger.entries.insert({ account: "cash", amount: "7", sequence: ID_BEYOND_NUMBER });
	});
}
