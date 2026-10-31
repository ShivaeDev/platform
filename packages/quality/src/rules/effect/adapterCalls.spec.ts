import { expect } from "vitest";
import { effectBoundary } from "#rules/effect/boundary.ts";
import { usesAt } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const folder of ["adapters", "nested/adapters", "router-adapters", "test-support"]) {
	const adapter = folder.split("/").includes("adapters");
	const helper = `src/${folder}/navigation.ts`;
	ruleStory.it(
		`effect/boundary ${adapter ? "accepts" : "reports"} a route calling a throwing helper defined in ${folder}/`,
		[
			repositoryHas(
				{
					content: 'import { redirect } from "router";\nexport function goHome() { throw redirect({ to: "/" }); }',
					path: helper,
				},
				{ content: `import { goHome as navigate } from "./${folder}/navigation.ts";\nnavigate();`, path: "src/route.ts" },
			),
		],
		function* ({ check }) {
			const findings = yield* check(effectBoundary);

			expect(findings).toEqual(
				adapter
					? []
					: [
							usesAt("src/route.ts", 2, "throwing helper call (navigate)"),
							...(folder === "test-support" ? [] : [usesAt(helper, 2, "throw statement")]),
						],
			);
		},
	);
}
