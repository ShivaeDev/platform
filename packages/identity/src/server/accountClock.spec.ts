import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { dayStartsAt, midnight, newYork, preferences } from "#test/account-preferences/story.ts";

for (const [instant, day] of [
	["2026-03-08T07:30:00Z", "2026-03-07"],
	["2026-03-08T07:59:59.999Z", "2026-03-07"],
	["2026-03-08T08:00:00Z", "2026-03-08"],
	["2026-11-01T05:30:00Z", "2026-10-31"],
	["2026-11-01T06:30:00Z", "2026-10-31"],
	["2026-11-01T08:59:59.999Z", "2026-10-31"],
	["2026-11-01T09:00:00Z", "2026-11-01"],
] as const) {
	preferences.it(`alice's 04:00 logical day at ${instant} is ${day}`, [newYork], function* ({ clockAt, day: logicalDay }) {
		yield* clockAt(instant);

		expect(yield* logicalDay()).toBe(day);
	});
}

for (const [day, start, end] of [
	["2026-03-07", "2026-03-07T09:00:00.000Z", "2026-03-08T08:00:00.000Z"],
	["2026-03-08", "2026-03-08T08:00:00.000Z", "2026-03-09T08:00:00.000Z"],
	["2026-10-31", "2026-10-31T08:00:00.000Z", "2026-11-01T09:00:00.000Z"],
] as const) {
	preferences.it(`alice's 04:00 range for ${day} spans the correct UTC boundaries`, [newYork], function* ({ range }) {
		const result = yield* range(day);

		expect(result).toEqual({ end, start });
	});
}

preferences.it("alice's default day starts at local midnight", [newYork, midnight], function* ({ clockAt, day }) {
	yield* clockAt("2026-03-08T07:30:00Z");

	expect(yield* day()).toBe("2026-03-08");
});

preferences.it("alice's next clock request uses her edited timezone", [newYork], function* ({ clockAt, day, set }) {
	yield* clockAt("2026-03-08T08:00:00Z");
	expect(yield* day()).toBe("2026-03-08");

	yield* set({ locale: "en-US", timezone: "America/Los_Angeles", units: "imperial" });

	expect(yield* day()).toBe("2026-03-07");
});

preferences.it("alice's configured 04:30 start keeps 04:15 in the previous day", [newYork, dayStartsAt(270)], function* ({ clockAt, day }) {
	yield* clockAt("2026-03-08T08:15:00Z");

	expect(yield* day()).toBe("2026-03-07");
});

preferences.it("alice's 02:30 start in the spring gap begins at 03:30 local time", [newYork, dayStartsAt(150)], function* ({ clockAt, day, range }) {
	yield* clockAt("2026-03-08T07:15:00Z");
	expect(yield* day()).toBe("2026-03-07");

	yield* clockAt("2026-03-08T07:30:00Z");

	yield* outcomes([
		["logical day", () => day(), "2026-03-08"],
		["day range", () => range("2026-03-08"), { end: "2026-03-09T06:30:00.000Z", start: "2026-03-08T07:30:00.000Z" }],
	]);
});

preferences.it(
	"alice's 01:30 start in the autumn overlap begins at the earlier occurrence",
	[newYork, dayStartsAt(90)],
	function* ({ clockAt, day, range }) {
		yield* clockAt("2026-11-01T05:29:59.999Z");
		expect(yield* day()).toBe("2026-10-31");

		yield* clockAt("2026-11-01T05:30:00Z");
		expect(yield* day()).toBe("2026-11-01");

		yield* clockAt("2026-11-01T06:15:00Z");

		yield* outcomes([
			["logical day", () => day(), "2026-11-01"],
			["day range", () => range("2026-11-01"), { end: "2026-11-02T06:30:00.000Z", start: "2026-11-01T05:30:00.000Z" }],
		]);
	},
);

preferences.it("alice can group a supplied instant independently of the current clock", [newYork], function* ({ clockAt, dayAt }) {
	yield* clockAt("2026-03-08T08:00:00Z");

	expect(yield* dayAt("2026-03-08T07:30:00Z")).toBe("2026-03-07");
});
