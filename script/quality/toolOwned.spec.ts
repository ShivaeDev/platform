import { expect } from "vitest";
import { namedAfterExport } from "@shivaedev/quality/rules/files/namedAfterExport.ts";
import { otherNames } from "@shivaedev/quality/rules/files/otherNames.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";

ruleKit.it(
	"configured source paths extend the default tool-owned names",
	[
		repositoryHas(
			{ content: "export function loadClient() {}\n", path: "src/generated/client.ts" },
			{ content: "export default function configure() {}\n", path: "vitest.config.ts" },
			{ content: "export interface Bindings {}\n", path: "src/env.d.ts" },
			{ content: "export function loadItem() {}\n", path: "src/fetch.ts" },
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(namedAfterExport, { toolOwned: [{ glob: "src/generated/", reason: "The generator owns these file names." }] });
		expect(findings.map((finding) => finding.file)).toEqual(["src/fetch.ts"]);
	},
);

ruleKit.it(
	"configured asset paths extend the default tool-owned names",
	[
		repositoryHas(
			{ content: "{}\n", path: "generated/ToolData.json" },
			{ content: "{}\n", path: "tsconfig.Build.json" },
			{ content: "{}\n", path: ".toolrc.json" },
			{ content: "{}\n", path: "assets/ToolData.json" },
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(otherNames, { toolOwned: [{ glob: "generated/", reason: "The generator owns these file names." }] });
		expect(findings.map((finding) => finding.file)).toEqual(["assets/ToolData.json"]);
	},
);

ruleKit.it(
	"a reasoned negated tool-owned pattern keeps a current authored module checked",
	[
		repositoryHas(
			{ content: "export function loadClient() {}\n", path: "src/generated/client.ts" },
			{ content: "export function authoredModule() {}\n", path: "src/generated/manual.ts" },
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(namedAfterExport, {
			toolOwned: [
				{ glob: "src/generated/*", reason: "The generator owns these names." },
				{ glob: "!src/generated/manual.ts", reason: "Application authors maintain this module." },
			],
		});
		expect(findings.map((finding) => finding.file)).toEqual(["src/generated/manual.ts"]);
	},
);
