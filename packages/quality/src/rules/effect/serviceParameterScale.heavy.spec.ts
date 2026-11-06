import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { carries, effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { serviceParameterWorkload } from "#test/serviceParameterWorkload.ts";

const workload = serviceParameterWorkload();
const expected = workload
	.flatMap(({ path, content }) =>
		path.includes("/module-")
			? content
					.split("\n")
					.flatMap((text, index) =>
						text.startsWith("export const run") ? ["store", "fileSystem"].map((parameter) => `${path}:${index + 1} ${carries(parameter)}`) : [],
					)
			: [],
	)
	.sort();

ruleStory.it(
	"service parameters classifies shared native and workspace types across a large repository",
	[effectResolves(), repositoryHas(...workload)],
	function* ({ check }) {
		const findings = yield* check(serviceParameters);

		expect(findings.map(({ file, line, message }) => `${file}:${line} ${message}`).sort()).toEqual(expected);
	},
);
