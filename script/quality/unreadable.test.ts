import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { unreadable } from "#quality/unreadable.ts";

for (const text of [
	"{",
	"[]",
	'{"dependencies": []}',
	'{"devDependencies": "effect"}',
	'{"optionalDependencies": null}',
	'{"peerDependencies": 1}',
]) {
	ruleKit.it(`rejects an unreadable manifest: ${text}`, [repositoryHas({ content: text, path: "package.json" })], function* ({ check }) {
		const findings = yield* check(unreadable);

		expect(findings).toEqual([{ file: "package.json", message: "is not a readable JSON manifest." }]);
	});
}

ruleKit.it(
	"accepts readable dependency maps",
	[
		repositoryHas({
			content: '{"dependencies":{"effect":"catalog:"}}',
			path: "package.json",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(unreadable);

		expect(findings).toEqual([]);
	},
);

ruleKit.it(
	"reports unreadable workspace manifests and a missing root manifest",
	[repositoryHas({ content: "broken", path: "packages/a/package.json" })],
	function* ({ check }) {
		const findings = yield* check(unreadable);

		expect(findings).toEqual([
			{ file: "package.json", message: "is not a readable JSON manifest." },
			{
				file: "packages/a/package.json",
				message: "is not a readable JSON manifest.",
			},
		]);
	},
);

ruleKit.it(
	"accepts readable root, application and package manifests",
	[
		repositoryHas(
			{ content: "{}", path: "examples/app/package.json" },
			{ content: "{}", path: "package.json" },
			{ content: "{}", path: "packages/a/package.json" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(unreadable);

		expect(findings).toEqual([]);
	},
);
