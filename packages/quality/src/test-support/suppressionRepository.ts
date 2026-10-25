import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { biomeOverrideInput } from "./biomeOverrideInput.ts";
import { qualityTree } from "./qualityTree.ts";
import { config } from "./tree.ts";

const REASON = "Vitest reads the fixture's first parameter and needs an object pattern.";

const declared = JSON.stringify({
	declared: [{ includes: ["src/vitest.ts"], reason: REASON, rule: "lint/correctness/noEmptyPattern" }],
});

const source = {
	content: "declare const raw: string;\n// @ts-expect-error The types reject it.\nexport const a: number = raw as unknown as number;\n",
	path: "src/a.ts",
};

export function undeclaredSuppressionRepository(): string {
	return qualityTree([config('{ sources: ["src"] }'), biomeOverrideInput({ correctness: { noEmptyPattern: "off" } }), source]);
}

export function declaredOverrideRepository(): string {
	return qualityTree([
		config(`{ rules: { "suppressions/biome-overrides": { options: ${declared} } }, sources: ["src"] }`),
		biomeOverrideInput({ correctness: { noEmptyPattern: "off" } }),
		{ content: "export function a(): number {\n\treturn 1;\n}\n", path: "src/a.ts" },
	]);
}

export function registeredSuppressionRepository(): string {
	const registry = [{ file: "src/a.ts", reason: "Legacy code.", rule: "suppressions/no-inline" }];
	return qualityTree([config('{ sources: ["src"] }'), source, { content: JSON.stringify(registry), path: "quality/registry.json" }]);
}

export function driftBiomeOverride(root: string): void {
	writeFileSync(join(root, "biome.json"), biomeOverrideInput({ suspicious: { noExplicitAny: "off" } }).content);
}

export function removeSuppressionRegistry(root: string): void {
	writeFileSync(join(root, "quality/registry.json"), "[]\n");
}

export function addInlineSuppression(root: string): void {
	writeFileSync(join(root, "src/a.ts"), `${source.content}// @ts-ignore\n`);
}
