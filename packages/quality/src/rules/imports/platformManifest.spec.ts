import { afterEach, expect, it } from "vitest";
import { importsManifest } from "#rules/imports/manifest.ts";
import { platformManifest } from "#test/platformManifest.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

it("enforces Platform's actual dependency declarations on package-pair probes", async () => {
	const { inputs } = await platformManifest();
	const configured = await importsManifest.configure(undefined);
	if (configured._tag !== "Ready") {
		throw new Error(configured.issues.join("\n"));
	}
	const findings = await configured.check(inputs);
	const rejected = new Set(findings.map((finding) => `${finding.file}:${finding.subject}`));
	expect(rejected.has("packages/effect-contract/src/manifestProbe.ts:@shivaedev/effect-form")).toBe(true);
	expect(rejected.has("packages/effect-contract/src/manifestProbe.ts:@shivaedev/types")).toBe(false);
	expect(rejected.has("packages/effect-react/src/manifestProbe.ts:@shivaedev/effect-sql")).toBe(true);
	expect(rejected.has("packages/effect-react/src/manifestProbe.ts:@shivaedev/effect-form")).toBe(false);
	expect(rejected.has("packages/effect-changes-prisma/src/manifestProbe.ts:@shivaedev/platform")).toBe(true);
	expect(rejected.has("packages/effect-changes-prisma/src/manifestProbe.ts:@shivaedev/effect-changes")).toBe(false);
});
