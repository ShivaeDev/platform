import { Effect } from "effect";
import { expect } from "vitest";
import { areaBrief, areaRepository } from "#test/areaRepository.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

for (const [invalid, suggestion] of [
	["effect-react", "react"],
	["work-fleet/schedulng", "work-fleet/scheduling"],
] as const) {
	engine.it(`dispatch rejects ${invalid} with the Board's folder suggestion`, [markdownWork(), areaRepository], function* (fleet) {
		fleet.writeBoardWork("one.md", areaBrief(["react", "work-fleet/scheduling", "jobs/server", "script/release", ".github"]));
		expect((yield* fleet.prepareWork("one")).value.areas).toEqual(["react", "work-fleet/scheduling", "jobs/server", "script/release", ".github"]);
		fleet.writeBoardWork("one.md", areaBrief([invalid]));
		const rejected = yield* fleet.dispatch("one").pipe(Effect.flip);
		expect(rejected).toMatchObject({ _tag: "BoardFailure" });
		expect(rejected.message).toContain(`Area "${invalid}" does not name an existing repository folder. Did you mean "${suggestion}"?`);
		expect((yield* fleet.get("one")).value.step).toBe("queued");
		expect(fleet.launches()).toEqual([]);
		fleet.writeBoardWork("one.md", areaBrief([suggestion]));
		expect((yield* fleet.dispatch("one")).value.step).toBe("working");
		expect(fleet.launches()).toEqual(["operation-1"]);
	});
}

engine.it("a rejected brief corrected to a wildcard blocks every folder", [markdownWork(), areaRepository], function* (fleet) {
	fleet.writeBoardWork("one.md", areaBrief(["effect-react"]));
	expect(yield* fleet.prepareWork("one").pipe(Effect.flip)).toMatchObject({ _tag: "BoardFailure" });
	expect(fleet.launches()).toEqual([]);
	fleet.writeBoardWork("one.md", areaBrief(["*"]));
	yield* fleet.prepareWork("one");
	expect((yield* fleet.dispatch("one")).value.step).toBe("working");
	for (const area of ["react", "work-fleet/scheduling", "jobs/server", "script/release", ".github"]) {
		fleet.writeBoardWork("two.md", areaBrief([area]).replace("id: one", "id: two"));
		yield* fleet.prepareWork("two");
		expect(yield* fleet.dispatch("two").pipe(Effect.flip)).toMatchObject({ _tag: "StorageAdmission" });
		expect((yield* fleet.get("two")).value.blocker).toContain(`waiting for area ${area} held by one`);
	}
	expect(fleet.launches()).toEqual(["operation-1"]);
});
