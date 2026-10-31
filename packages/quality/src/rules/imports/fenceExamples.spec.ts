import { expect } from "vitest";
import { fence } from "#imports/fence.ts";
import { files, folders, packages } from "#imports/fences/selectors.ts";
import { importFences } from "#rules/imports/fences.ts";
import { gameFences, gameRepository } from "#test/gameFences.ts";
import { importStory } from "#test/importStory.ts";

for (const path of ["packages/game/src/play.ts", "packages/simulation/src/step.ts", "packages/cms/src/edit.ts"]) {
	importStory.it(`imports/fences refuses a demonstration after its file ${path} is deleted`, [gameRepository], function* ({ removes, refusal }) {
		yield* removes(path);

		const problem = yield* refusal(importFences, { fences: [gameFences.gameNeverReachesCms] });

		expect(problem).toContain(`the illegal example names "${path}", which is no checked file`);
		if (path !== "packages/cms/src/edit.ts") {
			expect(problem).toContain(`the legal example names "${path}", which is no checked file`);
		}
	});
}

importStory.it(
	"imports/fences excepts one source file while its sibling still cannot reach the forbidden package",
	[gameRepository],
	function* ({ check }) {
		const policy = fence("game")
			.because("Only the editor entry may reach the CMS.")
			.from(folders("packages/game/src").except(files("packages/game/src/play.ts")))
			.mayNotReach(packages("cms"))
			.demonstratedBy({
				illegal: ["packages/game/src/run.ts", "packages/simulation/src/step.ts", "packages/cms/src/edit.ts"],
				legal: ["packages/game/src/play.ts", "packages/cms/src/edit.ts"],
			});

		const findings = yield* check(importFences, { fences: [policy] });

		expect(findings).toEqual([
			{
				file: "packages/game/src/run.ts",
				line: 1,
				message:
					'Reaches packages/cms/src/edit.ts through packages/game/src/run.ts -> packages/simulation/src/step.ts -> packages/cms/src/edit.ts across the fence "game": Only the editor entry may reach the CMS.',
				subject: "game",
			},
		]);
	},
);
