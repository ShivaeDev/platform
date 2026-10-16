import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { quality } from "#test/cli.ts";
import { qualityTree } from "#test/qualityTree.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

it.each(["rules", "get rules() { return rules; }"])("leaves migration inputs unchanged when legacy rules use %s", (property) => {
	const file = "src/parse.ts";
	const reason = "This parser preserves the external format.";
	const rules = {
		"suppressions/biome-overrides": { options: { declared: [{ includes: [file], reason, rule: "lint/suspicious/noExplicitAny" }] } },
	};
	const inputs = [
		{ content: `const rules = ${JSON.stringify(rules)}; export default { ${property}, sources: ["src"] };\n`, path: "quality.config.ts" },
		{ content: JSON.stringify([{ file, reason, rule: "comments/no-jsdoc" }]), path: "quality/registry.json" },
		{
			content: JSON.stringify({ overrides: [{ includes: [file], linter: { rules: { suspicious: { noExplicitAny: "off" } } } }] }),
			path: "biome.json",
		},
	];
	const root = qualityTree(inputs);
	const before = inputs.map(({ path }) => ({ content: readFileSync(join(root, path), "utf8"), path }));
	expect(quality(root, "exceptions", "migrate")).toMatchObject({
		status: 2,
		stderr: expect.stringContaining("Inline the rules object"),
	});
	for (const input of before) {
		expect(readFileSync(join(root, input.path), "utf8")).toBe(input.content);
	}
});
