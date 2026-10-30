import { Schema } from "effect";
import { expect, it } from "vitest";
import { PageUrl } from "#rpc/PageUrl.ts";

it.each(["https://example.com/note.md", "//example.com/note.md", "/\\["])("rejects %s with the local reading policy", (url) => {
	const result = Schema.decodeUnknownResult(PageUrl)(url);
	expect(result._tag).toBe("Failure");
	if (result._tag === "Failure") {
		expect(result.failure.message).toContain("Expected a local reading URL");
	}
});
