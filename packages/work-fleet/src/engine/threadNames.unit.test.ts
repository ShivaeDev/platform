import { expect, it } from "vitest";
import { threadName } from "#engine/threadNames.ts";

it("uses the first Board heading, trims whitespace and ignores frontmatter and fenced code", () => {
	const context = "---\nnotes: |\n  # Metadata\n---\n```md\n# Example\n```\n##  First   heading  ##\n# Later heading\n";
	expect(threadName("synthetic-work", context, "worker")).toBe("synthetic-work: First heading");
	expect(threadName("synthetic-work", "Setext title\n============\n", "worker")).toBe("synthetic-work: Setext title");
});

it("trims titles to 80 Unicode characters without changing the work ID or role", () => {
	const title = "🚀".repeat(90);
	expect(threadName("synthetic-work", `# ${title}`, "reviewer")).toBe(`synthetic-work (review): ${"🚀".repeat(79)}…`);
	expect(threadName("synthetic-work", `# ${"a".repeat(80)}`, "worker")).toBe(`synthetic-work: ${"a".repeat(80)}`);
});

it("labels separate reviewer and repair threads and falls back to the work ID without a heading", () => {
	expect(threadName("synthetic-work", "# Readable title", "reviewer")).toBe("synthetic-work (review): Readable title");
	expect(threadName("synthetic-work", "# Readable title", "repair")).toBe("synthetic-work (repair): Readable title");
	expect(threadName("synthetic-work", "No heading", "worker")).toBe("synthetic-work: synthetic-work");
	expect(threadName("synthetic-work", undefined, "worker")).toBe("synthetic-work: synthetic-work");
});
