import { expect, it } from "vitest";
import { payloadJobId, payloadKey } from "#server/adapters/payloadIdentity.ts";

it("only declared parts affect the deterministic job id", () => {
	expect(payloadJobId("notes", ["id"], { id: 42, note: "old" })).toBe(payloadJobId("notes", ["id"], { id: 42, note: "new" }));
});

it("queue names namespace deterministic job ids", () => {
	expect(payloadJobId("notes", ["id"], { id: 42 })).not.toBe(payloadJobId("other-notes", ["id"], { id: 42 }));
});

for (const { label, left, right } of [
	{ label: "separator boundaries", left: { first: "a:b", second: "c" }, right: { first: "a", second: "b:c" } },
	{ label: "strings from numbers", left: { first: "42", second: true }, right: { first: 42, second: true } },
	{ label: "null from strings", left: { first: null, second: true }, right: { first: "null", second: true } },
	{ label: "null from infinite numbers", left: { first: null, second: true }, right: { first: Number.POSITIVE_INFINITY, second: true } },
] as const) {
	it(`distinguishes ${label} in identity parts`, () => {
		expect(payloadKey(["first", "second"], left)).not.toBe(payloadKey(["first", "second"], right));
	});
}

it("empty parts give all payloads the same queue-wide id and key", () => {
	expect(payloadJobId("notes", [], { id: 42 })).toBe(payloadJobId("notes", [], { id: 99 }));
	expect(payloadKey([], { id: 42 })).toBe(payloadKey([], { id: 99 }));
});
