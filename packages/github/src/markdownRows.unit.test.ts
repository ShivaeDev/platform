import { Result } from "effect";
import { expect, it } from "vitest";
import { MarkdownBudgetTooSmall } from "./errors.ts";
import { renderRows, renderSections } from "./markdownRows.ts";

it("retains complete rows at an exact UTF-8 boundary and reports every dropped row", () => {
	const rows = ["😀", "&#64;team", ...Array.from({ length: 10 }, () => "too long")];
	expect(renderRows(rows, { byteLimit: 17 })).toEqual(Result.succeed("😀\n\nand 11 more"));
	expect(renderRows(rows, { byteLimit: 16 })).toEqual(Result.succeed("and 12 more"));
	expect(renderRows(["😀", "&#64;team"], { byteLimit: 14 })).toEqual(Result.succeed("😀\n&#64;team"));
});

it("counts headers and uses a blank line before the omitted-row notice", () => {
	expect(renderRows(["a much longer row than the entire budget"], { byteLimit: 23, header: "| A |\n| - |" })).toEqual(
		Result.succeed("| A |\n| - |\n\nand 1 more"),
	);
	expect(renderRows([], { byteLimit: 4, header: "😀" })).toEqual(Result.succeed("😀"));
	expect(renderRows([])).toEqual(Result.succeed(""));
	expect(renderRows(["long"], { byteLimit: 1 })).toEqual(Result.fail(new MarkdownBudgetTooSmall({ byteLimit: 1 })));
});

it("bounds the default body budget for a long list", () => {
	const body = Result.getOrThrow(renderRows(Array.from({ length: 20_000 }, () => "😀")));
	expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(60_000);
	expect(body).toMatch(/😀\n\nand \d+ more$/u);
});

it("shares one exact UTF-8 budget and gives each truncated section its own omitted count", () => {
	const sections = [
		{ header: "## A", rows: ["😀", "A".repeat(30), "tail"] },
		{ header: "## B", rows: ["é", "B".repeat(30), "tail"] },
	];
	expect(renderSections(sections, { byteLimit: 42 })).toEqual(Result.succeed("## A\n😀\n\nand 2 more\n\n## B\né\n\nand 2 more"));
	expect(renderSections(sections, { byteLimit: 41 })).toEqual(Result.succeed("## A\n😀\n\nand 2 more\n\n## B\n\nand 3 more"));
});

it("prioritizes earlier sections while reserving later headers and notices", () => {
	expect(
		renderSections(
			[
				{ header: "A", rows: ["one", "two"] },
				{ header: "B", rows: ["x".repeat(30), "y".repeat(30)] },
			],
			{ byteLimit: 24 },
		),
	).toEqual(Result.succeed("A\none\ntwo\n\nB\n\nand 2 more"));
});

it("reserves a complete notice for three sections and rejects an insufficient total budget", () => {
	const sections = ["A", "B", "C"].map((header) => ({ header, rows: ["x".repeat(50)] }));
	expect(renderSections(sections, { byteLimit: 43 })).toEqual(Result.succeed("A\n\nand 1 more\n\nB\n\nand 1 more\n\nC\n\nand 1 more"));
	expect(renderSections(sections, { byteLimit: 42 })).toEqual(Result.fail(new MarkdownBudgetTooSmall({ byteLimit: 42 })));
});

it("keeps short later lists whole when their rows cost less than an omitted-row notice", () => {
	expect(renderSections([{ rows: ["long".repeat(20)] }, { rows: ["x"] }], { byteLimit: 13 })).toEqual(Result.succeed("and 1 more\n\nx"));
});

it("joins nonempty sections and keeps header-only sections within the total budget", () => {
	expect(renderSections([], { byteLimit: 0 })).toEqual(Result.succeed(""));
	expect(renderSections([{ rows: [] }, { header: "😀", rows: [] }, { rows: ["x"] }], { byteLimit: 7 })).toEqual(Result.succeed("😀\n\nx"));
	expect(renderSections([{ header: "😀", rows: [] }], { byteLimit: 3 })).toEqual(Result.fail(new MarkdownBudgetTooSmall({ byteLimit: 3 })));
	expect(renderSections([{ rows: ["a", "b"] }], { byteLimit: 3 })).toEqual(Result.succeed("a\nb"));
});

it("bounds several long lists together at the default budget", () => {
	const body = Result.getOrThrow(renderSections(["A", "B", "C"].map((header) => ({ header, rows: Array.from({ length: 20_000 }, () => "😀") }))));
	expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(60_000);
	expect(body.match(/and \d+ more/gu)).toHaveLength(3);
});
