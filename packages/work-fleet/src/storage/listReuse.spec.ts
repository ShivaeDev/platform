import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { record } from "#test/storage.ts";
import { storage } from "#test/storageStory.ts";

storage.it("an unchanged second list decodes no records again", [], function* ({ decodedOnList, store }) {
	yield* store.insert(record("one"));
	yield* store.insert(record("two"));
	expect(yield* decodedOnList()).toBe("decoded records");

	const decodes = yield* decodedOnList();

	expect(decodes).toBe("decoded nothing");
});

storage.it(
	"a list after another writer changes one record rereads it and returns its new version",
	[],
	function* ({ decodedOnList, namespace, openStore, store }) {
		yield* store.insert(record("one"));
		const two = yield* store.insert(record("two"));
		yield* decodedOnList();
		const other = yield* openStore(namespace);

		const running = yield* other.compareAndSet("two", two.version, { ...two.value, step: "running" });

		yield* outcomes([
			["record decodes", () => decodedOnList(), "decoded records"],
			["listed steps", () => store.list().pipe(Effect.map((entries) => entries.map(({ value }) => value.step))), ["queued", "running"]],
			["listed second record", () => store.list().pipe(Effect.map((entries) => entries[1])), running],
		]);
	},
);

storage.it(
	"a list read inside a rolled-back write never serves that write after another writer commits the same version",
	[],
	function* ({ listInsideRolledBackWrite, namespace, openStore, store }) {
		const one = yield* store.insert(record("one"));
		yield* listInsideRolledBackWrite(one, { step: "running" });

		const terminal = yield* (yield* openStore(namespace)).compareAndSet("one", one.version, { ...one.value, step: "terminal" });

		expect(yield* store.list()).toEqual([terminal]);
	},
);
