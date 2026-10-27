import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { namedValues } from "#rules/stories/namedValues.ts";
import { storySpecs } from "#rules/stories/specs.ts";

ruleKit.it(
	"HTTP status assertions name Effect's statuses while process exit codes keep their literals",
	[
		repositoryHas({
			content: [
				"expect(response.status).toBe(404);",
				"expect(code).toBe(463);",
				'expect.soft((response["status"])).not.toBe((+500));',
				"expect(status).toBe(201);",
				"expect(response.code).toBe(2);",
				"expect(status).toHaveLength(1);",
				"expect(exitCode).toBe(1);",
				'expect.soft(process["exitCode"]).not.toBe(-1);',
			].join("\n"),
			path: "src/orders.spec.ts",
		}),
	],
	function* ({ checks, writes }) {
		const findings = yield* checks(namedValues);
		expect(findings.map((finding) => finding.line)).toEqual([1, 2, 3, 4, 5, 6]);
		for (const finding of findings) {
			expect(finding.message).toContain('import * as HttpStatus from "effect/http/HttpStatus"');
			expect(finding.message).toContain('HttpStatus.fromLiteral("NotFound")');
		}
		yield* writes({
			content: [
				'import * as HttpStatus from "effect/http/HttpStatus";',
				'expect(response.status).toBe(HttpStatus.fromLiteral("NotFound"));',
				'expect(code).toBe(HttpStatus.fromLiteral("Forbidden"));',
				'expect.soft((response["status"])).not.toBe(HttpStatus.fromLiteral("InternalServerError"));',
				'expect(status).toBe(HttpStatus.fromLiteral("Created"));',
				"expect(exitCode).toBe(1);",
				'expect.soft(process["exitCode"]).not.toBe(-1);',
			].join("\n"),
			path: "src/orders.spec.ts",
		});
		expect(yield* checks(namedValues)).toEqual([]);
	},
);

ruleKit.it(
	"pure unit tests import Effect's status names directly or through fixtures while HTTP clients still require a story",
	[
		repositoryHas(
			{ content: 'import * as HttpStatus from "effect/http/HttpStatus";', path: "src/direct.unit.test.ts" },
			{
				content: 'export * as HttpStatus from "effect/http/HttpStatus";',
				path: "src/test-support/status.ts",
			},
			{ content: 'import { HttpStatus } from "./test-support/status.ts";', path: "src/fixture.unit.test.ts" },
			{ content: 'import { HttpClient } from "effect/http";', path: "src/network.unit.test.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(storySpecs)).toEqual([
			{
				file: "src/network.unit.test.ts",
				line: 1,
				message: expect.stringContaining("reaches the network (effect/http)"),
			},
		]);
	},
);
