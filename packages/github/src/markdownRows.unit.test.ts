import { expect, it } from "vitest";
import { renderRows } from "./markdownRows.ts";

it("retains complete rows at an exact UTF-8 boundary and reports every dropped row", () => {
	const rows = ["😀", "&#64;team", ...Array.from({ length: 10 }, () => "too long")];
	expect(renderRows(rows, { byteLimit: 17 })).toBe("😀\n\nand 11 more");
	expect(renderRows(rows, { byteLimit: 16 })).toBe("and 12 more");
	expect(renderRows(["😀", "&#64;team"], { byteLimit: 14 })).toBe("😀\n&#64;team");
});

it("counts headers and uses a blank line before the omitted-row notice", () => {
	expect(renderRows(["a much longer row than the entire budget"], { byteLimit: 23, header: "| A |\n| - |" })).toBe("| A |\n| - |\n\nand 1 more");
	expect(renderRows([], { byteLimit: 4, header: "😀" })).toBe("😀");
	expect(renderRows([])).toBe("");
	expect(() => renderRows(["long"], { byteLimit: 1 })).toThrow(RangeError);
});

it("bounds the default body budget for a long list", () => {
	const body = renderRows(Array.from({ length: 20_000 }, () => "😀"));
	expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(60_000);
	expect(body).toMatch(/😀\n\nand \d+ more$/u);
});
