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
		expect((yield* fleet.get("one")).value).toMatchObject({ blocker: expect.stringContaining("held by https://github.com/"), step: "queued" });
		expect((yield* fleet.dispatch("two"))._tag).toBe("Success");
		const two = (yield* fleet.get("two")).value;
		expect(two).toMatchObject({ attempts: [{ role: "worker" }], step: "working" });
		expect(fleet.launches()).toEqual(two.attempts.map(({ operationId }) => operationId));
		fleet.prReadFails();
		expect(yield* fleet.admit()).toEqual([expect.stringContaining("https://github.com/synthetic/project/pull/10")]);
		yield* fleet.dispatch("one");
		expect((yield* fleet.get("one")).value.step).toBe("queued");
		fleet.pr("closed");
		expect(yield* fleet.admit()).toEqual([]);
		expect(yield* fleet.reservations()).toEqual([]);
		expect((yield* fleet.dispatch("one"))._tag).toBe("Success");
		expect((yield* fleet.get("one")).value.step).toBe("working");
		const one = (yield* fleet.get("one")).value;
		expect(one.attempts).toMatchObject([{ role: "worker" }]);
		expect(fleet.launches()).toEqual([...two.attempts, ...one.attempts].map(({ operationId }) => operationId));
	});
}
