import { Schema } from "effect";
import { expect, it } from "vitest";
import { collection } from "@shivaedev/changes/keys.ts";
import { query } from "#operation.ts";
import { changesRpc } from "#serverMetadata.ts";

const notes = collection("notes", Schema.Number);
const Get = query("get", { payload: { id: Schema.NumberFromString }, reads: ({ id }) => [notes.item(id)] });
const List = query("list", { reads: () => [notes.list] });
const changes = changesRpc("notes", [Get, List]);

it("builds references from declared query payload codecs and excludes raw keys and undeclared operations", () => {
	const decode = Schema.decodeUnknownResult(changes.payloadSchema);
	expect(
		decode({
			queries: [
				{ payload: { id: "1" }, query: "get" },
				{ payload: undefined, query: "list" },
			],
		}),
	).toMatchObject({
		_tag: "Success",
		success: {
			queries: [
				{ payload: { id: 1 }, query: "get" },
				{ payload: undefined, query: "list" },
			],
		},
	});
	for (const payload of [
		{ keys: [notes.item(1)] },
		{ queries: [{ payload: { id: "1" }, query: "save" }] },
		{ queries: [{ payload: { id: true }, query: "get" }] },
	]) {
		expect(decode(payload)._tag).toBe("Failure");
	}
});
