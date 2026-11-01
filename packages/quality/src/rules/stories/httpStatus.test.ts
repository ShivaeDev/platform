import { expect } from "vitest";
import { httpStatus } from "#rules/stories/httpStatus.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const [shape, branch] of [
	["comparison", 'if (error.status === HttpStatus.fromLiteral("NotFound")) recover();'],
	["reversed comparison", 'if (HttpStatus.fromLiteral("Forbidden") === error["status"]) deny();'],
	["switch case", 'switch (error.status) { case HttpStatus.fromLiteral("Conflict"): break; }'],
	["status list", 'if ([HttpStatus.fromLiteral("Unauthorized"), HttpStatus.fromLiteral("Forbidden")].includes(error.status)) deny();'],
] as const) {
	ruleStory.it(
		`an HttpStatus.fromLiteral ${shape} outside the configured HTTP edge is reported`,
		[
			repositoryHas(
				{ content: `import * as HttpStatus from "effect/http/HttpStatus";\n${branch}`, path: "src/orders.ts" },
				{ content: `import * as HttpStatus from "effect/http/HttpStatus";\n${branch}`, path: "src/http/orders.ts" },
			),
		],
		function* ({ check, locations }) {
			yield* check(httpStatus, { edge: [{ glob: "src/http/**", reason: "The HTTP adapter translates transport statuses into domain errors." }] });

			expect(yield* locations()).toEqual(["src/orders.ts:2"]);
		},
	);
}

ruleStory.it(
	"successful HTTP statuses and process exit statuses remain outside the HTTP error rule",
	[
		repositoryHas({
			content: [
				'import * as HttpStatus from "effect/http/HttpStatus";',
				'if (response.status === HttpStatus.fromLiteral("OK")) accept();',
				'if (response.status === HttpStatus.fromLiteral("NotModified")) reuse();',
				"if (processResult.status !== 0) fail();",
			].join("\n"),
			path: "src/orders.ts",
		}),
	],
	function* ({ check }) {
		expect(yield* check(httpStatus)).toEqual([]);
	},
);
