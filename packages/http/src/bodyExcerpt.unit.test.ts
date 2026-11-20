import { describe, expect, it } from "vitest";
import { bodyExcerpt } from "#bodyExcerpt.ts";

function bytes(text: string) {
	return new TextEncoder().encode(text);
}

describe("bodyExcerpt", () => {
	it("collapses whitespace in a complete text body", () => {
		expect(bodyExcerpt(bytes("  rate limit\n\texceeded  "), false)).toBe("rate limit exceeded");
	});

	it("drops the word a cut split and marks the cut", () => {
		expect(bodyExcerpt(bytes('{"error":"invalid_grant","hint":"eyJhbGciOi'), true)).toBe('{"error":"invalid_grant","hint":"…');
	});

	it("keeps a complete body's last word", () => {
		expect(bodyExcerpt(bytes("try again later"), false)).toBe("try again later");
	});

	it("drops a multibyte character the cut split instead of replacing it", () => {
		expect(bodyExcerpt(bytes("total: €").subarray(0, 8), true)).toBe("total:…");
	});

	it("masks a sensitive assignment", () => {
		expect(bodyExcerpt(bytes("client_secret=abc123&grant=refresh"), false)).toBe("client_secret=<redacted>&grant=refresh");
	});

	for (const [name, body] of [
		["NUL bytes", new Uint8Array([0x7b, 0x00, 0x7d])],
		["invalid UTF-8", new Uint8Array([0x7b, 0xff, 0x7d])],
	] as const) {
		it(`omits a body with ${name}`, () => {
			expect(bodyExcerpt(body, false)).toBeUndefined();
		});
	}

	it("omits an empty or blank body", () => {
		expect(bodyExcerpt(bytes(" \n "), false)).toBeUndefined();
	});
});
