import { expect } from "@effect/vitest";
import { publishedErrorFiles, publishedErrorStory } from "#test/publishedErrorFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { kitFiles } from "#testing/adapters/storySpecFiles.ts";
import { storyEngine } from "./engine.ts";

for (const [imports, errorClass] of [
	['import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";', "ServiceUnavailable"],
	['import { ServiceUnavailable as Unavailable } from "@shivaedev/errors";', "Unavailable"],
	['import * as Errors from "@shivaedev/errors";', "Errors.ServiceUnavailable"],
	['import { ServiceUnavailable } from "@shivaedev/errors/source.ts";', "ServiceUnavailable"],
] as const) {
	ruleStory.it(
		`tests/story-engine accepts installed Schema error data via ${imports}`,
		[repositoryHas(...kitFiles, ...publishedErrorFiles, publishedErrorStory(imports, `new ${errorClass}({ message: "try later" })`))],
		function* ({ check }) {
			const findings = yield* check(storyEngine);

			expect(findings).toEqual([]);
		},
	);
}

ruleStory.it(
	"tests/story-engine resolves Schema errors from a consumer workspace's own installation",
	[
		repositoryHas(
			{ content: '{"workspaces":["packages/*"]}', path: "package.json" },
			...[
				...kitFiles,
				...publishedErrorFiles,
				publishedErrorStory(
					'import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";',
					'new ServiceUnavailable({ message: "try later" })',
				),
			].map((file) => ({ ...file, path: `packages/consumer/${file.path}` })),
		),
	],
	function* ({ check }) {
		const findings = yield* check(storyEngine);

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"tests/story-engine rejects a production constructor from the same installed package as Schema errors",
	[
		repositoryHas(
			...kitFiles,
			...publishedErrorFiles,
			publishedErrorStory('import { DeliveryService } from "@shivaedev/errors";', "new DeliveryService()"),
		),
	],
	function* ({ check }) {
		const findings = yield* check(storyEngine);

		expect(findings).toEqual([
			expect.objectContaining({ file: "src/delivery.spec.ts", line: 4, message: expect.stringContaining("Calls a production constructor") }),
		]);
	},
);
