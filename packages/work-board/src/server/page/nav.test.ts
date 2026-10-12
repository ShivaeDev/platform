import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { inboxSnapshot } from "#test/inboxFixture.ts";
import { navigationFixture } from "#test/navigationFixture.ts";
import { navHtml } from "./nav.ts";

it.each([
	["packages/form/README.md", "current"],
	["responses/decision.md", "record"],
	["missing.md", "missing"],
])("preserves sidebar HTML for %s", (current, fixture) => {
	const snapshot = inboxSnapshot(navigationFixture());
	const files = snapshot.documents.map((entry) => ({ modified: snapshot.modified.get(entry.file) ?? 0, path: entry.file }));
	const expected = readFileSync(new URL(`../../test-support/navigation/${fixture}.txt`, import.meta.url), "utf8");
	expect(navHtml(files, current, "packages/README.md", snapshot)).toBe(expected);
});

it("preserves the unknown Inbox count and empty sidebar", () => {
	expect(navHtml([], "", undefined)).toBe('<ul data-inbox-count="?"></ul>');
	const snapshot = inboxSnapshot({}, ["missing.md"]);
	expect(navHtml([], "", undefined, snapshot)).toBe('<ul data-inbox-count="?"></ul>');
});
