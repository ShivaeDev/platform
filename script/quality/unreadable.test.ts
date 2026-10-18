import { expect, it } from "vitest";
import { checkRule } from "#quality/test-support/checkRule.ts";
import { unreadable } from "./unreadable.ts";

it.each(["{", "[]", '{"dependencies": []}', '{"devDependencies": "effect"}', '{"optionalDependencies": null}', '{"peerDependencies": 1}'])(
	"rejects an unreadable manifest: %s",
	async (text) => {
		expect(await checkRule(unreadable, { "package.json": text })).toEqual([{ file: "package.json", message: "is not a readable JSON manifest." }]);
		expect(await checkRule(unreadable, { "package.json": '{"dependencies":{"effect":"catalog:"}}' })).toEqual([]);
	},
);

it("checks workspace manifests and requires the root manifest", async () => {
	expect(await checkRule(unreadable, { "packages/a/package.json": "broken" })).toEqual([
		{ file: "package.json", message: "is not a readable JSON manifest." },
		{ file: "packages/a/package.json", message: "is not a readable JSON manifest." },
	]);
	expect(await checkRule(unreadable, { "examples/app/package.json": "{}", "package.json": "{}", "packages/a/package.json": "{}" })).toEqual([]);
});
