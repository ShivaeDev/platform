import { expect } from "vitest";
import { registrationStory } from "#test/story.ts";

for (const composition of ["together", "modules"] as const) {
	for (const [left, right] of [
		[{ detail: "/admin/jobs/$id", path: "/admin/jobs" }, { path: "/admin/jobs/export" }],
		[
			{ detail: "/admin/jobs/$id/edit", path: "/admin/jobs" },
			{ detail: "/admin/jobs/export/$tab", path: "/admin/jobs/export" },
		],
	] as const) {
		for (const routes of [
			[left, right],
			[right, left],
		] as const) {
			registrationStory.it(
				`overlapping routes ${routes[0].detail ?? routes[0].path} and ${routes[1].detail ?? routes[1].path} are refused ${composition}`,
				[],
				function* ({ composeRoutes }) {
					expect(yield* composeRoutes(composition, ...routes)).toMatch(/^Overlapping admin paths:/u);
				},
			);
		}
	}
}

for (const detail of ["/admin/users/$id", "/admin/jobs-archive/$id", "/admin/jobs", "/admin/jobs/"]) {
	registrationStory.it(`the jobs page refuses detail ${detail} outside its descendants`, [], function* ({ composeRoutes }) {
		expect(yield* composeRoutes("together", { detail, path: "/admin/jobs" })).toBe(`Admin detail path ${detail} must be under page path /admin/jobs`);
	});
}

registrationStory.it("composition refuses the same list path with a trailing slash", [], function* ({ composeRoutes }) {
	expect(yield* composeRoutes("together", { path: "/admin/jobs" }, { path: "/admin/jobs/" })).toBe("Duplicate admin path: /admin/jobs");
});

registrationStory.it("distinct descendants and adjacent page names compose", [], function* ({ composeRoutes }) {
	expect(
		yield* composeRoutes(
			"together",
			{ detail: "/admin/jobs/$id/edit", path: "/admin/jobs/" },
			{ path: "/admin/jobs/export" },
			{ path: "/admin/jobs-archive" },
		),
	).toBe("composed");
});
