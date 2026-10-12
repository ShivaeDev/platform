import { expect, it } from "vitest";
import { resetLabel } from "#diagnostics/resetLabel.ts";

it("distinguishes upcoming, elapsed and immediate resets with a local clock", () => {
	const at = Date.UTC(2026, 9, 11, 14, 20);
	const local = new Intl.DateTimeFormat(undefined, { hour: "2-digit", hour12: false, minute: "2-digit" }).format(at);
	for (const [offset, relative] of [
		[-3 * 3_600_000, "in 3 h"],
		[-7 * 86_400_000, "in 7 d"],
		[-5 * 60_000, "in 5 min"],
		[5 * 60_000, "5 min ago"],
		[0, "now"],
	] as const) {
		expect(resetLabel(at, at + offset)).toBe(`${relative}, ${local}`);
	}
});
