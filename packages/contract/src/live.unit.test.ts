import { Schema } from "effect";
import { expect, it } from "vitest";
import { notes } from "@shivaedev/test-kits/test-support/notes/model.ts";
import { LiveHint } from "#live.ts";

it("rejects unknown hints and invalid read keys at the Schema boundary", () => {
	const decode = Schema.decodeUnknownResult(LiveHint);
	for (const value of [{ _tag: "Unknown" }, { _tag: "Changed", keys: [{ _tag: "Item", collection: "notes", id: true }] }]) {
		expect(decode(value)._tag).toBe("Failure");
	}
	expect(decode({ _tag: "Changed", keys: [notes.item(1)] })._tag).toBe("Success");
	expect(decode({ _tag: "Changed", keys: [{ _tag: "Item", collection: "documents", id: "one" }] })._tag).toBe("Success");
});
