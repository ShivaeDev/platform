import { expect } from "vitest";
import { areaRepository } from "#test/areaRepository.ts";
import { boardStory } from "#test/boardStory.ts";

boardStory.it(
	"a brief names existing packages, subfolders and top-level folders",
	[areaRepository(["react", "work-fleet/scheduling", "jobs/server", "script/release", ".github", "*"])],
	function* (board) {
		const brief = yield* board.readDocument("task.md");
		expect(brief.diagnostics).toEqual([]);
		expect(brief.metadata.areas).toEqual(["react", "work-fleet/scheduling", "jobs/server", "script/release", ".github", "*"]);
		board.editFile("task.md", "---\nid: task\nkind: task\nareas: [work-fleet/schedulng]\n---\n# Work");
		expect((yield* board.readDocument("task.md")).diagnostics).toEqual([
			{
				field: "areas",
				line: 4,
				message: 'Area "work-fleet/schedulng" does not name an existing repository folder. Did you mean "work-fleet/scheduling"?',
			},
		]);
	},
);

boardStory.it("a renamed package is invalid and suggests its existing name", [areaRepository(["effect-react"])], function* (board) {
	expect((yield* board.readDocument("task.md")).diagnostics).toEqual([
		{ field: "areas", line: 4, message: 'Area "effect-react" does not name an existing repository folder. Did you mean "react"?' },
	]);
});

for (const status of ["done", "dropped"]) {
	boardStory.it(`a ${status} brief has no diagnostic for a renamed area`, [areaRepository(["effect-react"])], function* (board) {
		board.editFile("task.md", `---\nid: task\nkind: task\nstatus: ${status}\nareas: [effect-react]\n---\n# Work`);
		expect((yield* board.readDocument("task.md")).diagnostics).toEqual([]);
	});
}
