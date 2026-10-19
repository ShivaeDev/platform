import { Schema } from "effect";
import { expect, it } from "vitest";
import { LiveHint } from "#live.ts";
import { notes } from "#test/notes.ts";

it("rejects unknown hints and invalid read keys at the Schema boundary", () => {
	const decode = Schema.decodeUnknownResult(LiveHint);
	for (const value of [{ _tag: "Unknown" }, { _tag: "Changed", keys: [{ _tag: "Item", collection: "notes", id: true }] }]) {
		expect(decode(value)._tag).toBe("Failure");
	}
	expect(decode({ _tag: "Changed", keys: [notes.item(1)] })._tag).toBe("Success");
	expect(decode({ _tag: "Changed", keys: [{ _tag: "Item", collection: "documents", id: "one" }] })._tag).toBe("Success");
});
