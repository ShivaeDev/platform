import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/test/it.ts";
import { parseChangeset } from "#parser.ts";

describe("changeset parsing", () => {
	it.effect("reads quoted and bare YAML mappings, comments, CRLF and multiline Markdown entries", function* () {
		const parsed = yield* parseChangeset({
			name: "feature.md",
			text: "---\r\n# Explicit bumps\r\n'@scope/one': 'minor' # breaking\r\n\"@scope/two\": \"patch\"\r\nplain-package: major\r\n---\r\n\r\n### Breaking\r\n\r\n- A breaking change.\r\n  With a continuation.\r\n",
		});
		expect(parsed.packages).toEqual({ "@scope/one": "minor", "@scope/two": "patch", "plain-package": "major" });
		expect(parsed.entries).toEqual([{ section: "Breaking", text: "- A breaking change.\n  With a continuation." }]);
	});
	it.effect("returns malformed quoted scalars in the error channel with their original non-enumerable cause", function* () {
		const error = yield* Effect.flip(parseChangeset({ name: "broken.md", text: '---\n"\\q": patch\n---\n\n### Fixed\n\n- A fix.\n' }));
		expect(error._tag).toBe("ChangesetError");
		expect(error.cause).toBeInstanceOf(Error);
		expect(Object.getOwnPropertyDescriptor(error, "cause")?.enumerable).toBe(false);
	});
});
