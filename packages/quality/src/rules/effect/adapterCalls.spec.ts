import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { effectBoundary } from "#rules/effect/boundary.ts";
import { usesAt } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const folder of ["adapters", "nested/adapters", "router-adapters", "test-support"]) {
	const adapter = folder.split("/").includes("adapters");
	const helper = `src/${folder}/navigation.ts`;
	const expected = adapter
		? []
		: [usesAt("src/route.ts", 2, "throwing helper call (navigate)"), ...(folder === "test-support" ? [] : [usesAt(helper, 2, "throw statement")])];
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

			yield* assertThat(findings, (actual) => actual.toEqual(expected));
		},
	);
}
