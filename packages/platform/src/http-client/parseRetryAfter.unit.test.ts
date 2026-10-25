import { DateTime } from "effect";
import { expect, it } from "vitest";
import { parseRetryAfter } from "./parseRetryAfter.ts";

const now = DateTime.makeUnsafe("2026-10-25T10:00:00Z");

it.each([
	["120", "2026-10-25T10:02:00.000Z"],
	["0", "2026-10-25T10:00:00.000Z"],
	["Sun, 25 Oct 2026 11:00:00 GMT", "2026-10-25T11:00:00.000Z"],
])("parses Retry-After %s as a UTC instant", (header, expected) => {
	const result = parseRetryAfter(header, now);
	expect(result && DateTime.formatIso(result)).toBe(expected);
});

it.each([undefined, "", "garbage", "-1", "1.5", "Infinity", "Sun, 99 Oct 2026 11:00:00 GMT", "9".repeat(400)])(
	"leaves missing or invalid Retry-After %s undefined",
	(header) => {
		expect(parseRetryAfter(header, now)).toBeUndefined();
	},
);
