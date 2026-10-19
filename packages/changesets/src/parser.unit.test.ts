import { describe, expect, it } from "vitest";
import { parseChangeset } from "#parser.ts";

describe("changeset parsing", () => {
	it("reads quoted and bare YAML mappings, comments, CRLF and multiline Markdown entries", () => {
		const parsed = parseChangeset({
			name: "feature.md",
			text: "---\r\n# Explicit bumps\r\n'@scope/one': 'minor' # breaking\r\n\"@scope/two\": \"patch\"\r\nplain-package: major\r\n---\r\n\r\n### Breaking\r\n\r\n- A breaking change.\r\n  With a continuation.\r\n",
		});
		expect(parsed.packages).toEqual({ "@scope/one": "minor", "@scope/two": "patch", "plain-package": "major" });
		expect(parsed.entries).toEqual([{ section: "Breaking", text: "- A breaking change.\n  With a continuation." }]);
	});
});
