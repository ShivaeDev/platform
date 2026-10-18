import { expect } from "vitest";
import { foreignAreaStory } from "#test/foreignAreaStory.ts";

for (const match of ["pr", "branch", "worker-branch", "unmatched"] as const) {
	foreignAreaStory.it(`a foreign PR uses ${match} areas and blocks overlapping work until it closes`, [], function* (fleet) {
		fleet.pr("open", match === "worker-branch" ? "worker/foreign" : "foreign/feature");
		if (match !== "unmatched") {
			const metadata = { branch: "branch: foreign/feature\n", pr: "pr: https://github.com/synthetic/project/pull/10\n", "worker-branch": "" }[match];
			fleet.task("foreign", ["work-fleet"], metadata, false);
		}
		fleet.task("one", ["work-fleet/host"]);
		fleet.task("two", ["work-board/ui"]);
		expect(yield* fleet.reserve(match === "unmatched" ? ["work-fleet", "documentation"] : ["ignored"])).toMatchObject({ code: 0, stderr: "" });
		expect(yield* fleet.reservations()).toMatchObject([
			{ areas: match === "unmatched" ? ["work-fleet", "documentation"] : ["work-fleet"], backlog: true, executing: false },
		]);
		expect(yield* fleet.admit()).toEqual([]);
		yield* fleet.dispatch("one");
		expect((yield* fleet.get("one")).value).toMatchObject({ blocker: expect.stringContaining("held by https://github.com/"), stage: "prepared" });
		expect((yield* fleet.dispatch("two"))._tag).toBe("Success");
		expect(fleet.launches()).toHaveLength(1);
		fleet.prReadFails();
		expect(yield* fleet.admit()).toHaveLength(1);
		yield* fleet.dispatch("one");
		expect((yield* fleet.get("one")).value.stage).toBe("prepared");
		fleet.pr("closed");
		expect(yield* fleet.admit()).toEqual([]);
		expect(yield* fleet.reservations()).toEqual([]);
		expect((yield* fleet.dispatch("one"))._tag).toBe("Success");
		expect((yield* fleet.get("one")).value.stage).toBe("executing");
		expect(fleet.launches()).toHaveLength(2);
	});
}
