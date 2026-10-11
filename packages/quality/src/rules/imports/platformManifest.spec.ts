import { afterEach, expect, it } from "vitest";
import { importsManifest } from "#rules/imports/manifest.ts";
import { platformManifest } from "#test/platformManifest.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

it("rejects every package pair today's leaf fences reject using the actual manifests and policy", async () => {
	const { fences, inputs, packages } = await platformManifest();
	const configured = await importsManifest.configure(undefined);
	expect(configured._tag).toBe("Ready");
	if (configured._tag !== "Ready") {
		return;
	}
	const legacy = (await fences.check(inputs)).filter((finding) => finding.subject?.startsWith("leaf-"));
	const findings = await configured.check(inputs);
	const rejected = new Set(findings.map((finding) => `${finding.file}:${finding.line}`));
	expect(legacy.length).toBeGreaterThan(0);
	for (const finding of legacy) {
		expect(rejected.has(`${finding.file}:${finding.line}`), finding.message).toBe(true);
	}
	const held = new Set(legacy.map((finding) => finding.file));
	const withoutFence = findings.filter((finding) => !held.has(finding.file));
	expect(withoutFence.length).toBeGreaterThan(0);
	expect(packages.length).toBeGreaterThan(18);
}, 30_000);
