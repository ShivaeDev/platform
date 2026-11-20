import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { expect, it } from "vitest";
import { indexedQueryRows } from "#adapters/indexedQueryRows.ts";

function freshRows() {
	const host = { factory: new IDBFactory(), keyRange: IDBKeyRange };
	return indexedQueryRows(() => host);
}

const first = { key: "first", used: 1, value: '"one"' };
const second = { key: "second", used: 2, value: '"two"' };

it("reads back the entries written for a user", async () => {
	const rows = freshRows();
	await rows.setItems("alice", [first, second]);
	await rows.setItems("alice", [{ ...first, used: 3 }]);
	expect(await rows.getAll("alice")).toEqual([{ ...first, used: 3 }, second]);
});

it("removes only the named entries", async () => {
	const rows = freshRows();
	await rows.setItems("alice", [first, second]);
	await rows.removeItems("alice", ["first"]);
	expect(await rows.getAll("alice")).toEqual([second]);
});

it("clears one user and leaves another user's entries", async () => {
	const rows = freshRows();
	await rows.setItems("alice", [first]);
	await rows.setItems("alice-2", [second]);
	await rows.clear("alice");
	expect([await rows.getAll("alice"), await rows.getAll("alice-2")]).toEqual([[], [second]]);
});

it("clears every user", async () => {
	const rows = freshRows();
	await rows.setItems("alice", [first]);
	await rows.setItems("bob", [second]);
	await rows.clear();
	expect([await rows.getAll("alice"), await rows.getAll("bob")]).toEqual([[], []]);
});
