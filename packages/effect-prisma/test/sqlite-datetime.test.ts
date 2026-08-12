import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizeSqliteDatetime } from "../src/internal/sqlite-datetime.js";

describe("SQLite datetime normalization", () => {
	it("marks zone-less datetime strings as UTC", () => {
		expect(normalizeSqliteDatetime("2026-08-11 23:12:16")).toBe(
			"2026-08-11T23:12:16Z",
		);
		expect(normalizeSqliteDatetime("2026-08-11T23:12:16")).toBe(
			"2026-08-11T23:12:16Z",
		);
		expect(normalizeSqliteDatetime("2026-08-11 23:12:16.789")).toBe(
			"2026-08-11T23:12:16.789Z",
		);
		expect(normalizeSqliteDatetime("2026-08-11 23:12")).toBe(
			"2026-08-11T23:12Z",
		);
	});

	it("leaves values that already carry a zone unchanged", () => {
		for (const value of [
			"2026-08-11T23:12:16Z",
			"2026-08-11T23:12:16.789Z",
			"2026-08-11T23:12:16+02:00",
			"2026-08-11T23:12:16-04:00",
			"2026-08-11",
			"not a datetime",
		]) {
			expect(normalizeSqliteDatetime(value)).toBe(value);
		}
	});

	describe("outside UTC", () => {
		const original = process.env.TZ;

		beforeAll(() => {
			process.env.TZ = "America/New_York";
		});

		afterAll(() => {
			process.env.TZ = original;
		});

		it("keeps the instant SQLite wrote instead of shifting by the UTC offset", () => {
			const stored = "2026-08-11 23:12:16";

			expect(new Date(stored).toISOString()).not.toBe(
				"2026-08-11T23:12:16.000Z",
			);
			expect(new Date(normalizeSqliteDatetime(stored)).toISOString()).toBe(
				"2026-08-11T23:12:16.000Z",
			);
		});

		it("does not move values that already carry a zone", () => {
			const stored = "2026-08-11T23:12:16.789Z";

			expect(new Date(normalizeSqliteDatetime(stored)).toISOString()).toBe(
				new Date(stored).toISOString(),
			);
		});
	});
});
