import { describe, expect, it } from "vitest";
import { biomeOverrides } from "../src/rules/suppressions/biome-overrides.ts";
import { checkRule } from "./support/inputs.ts";

type Options = Parameters<typeof biomeOverrides.configure>[0];

const reason = "Tools load their config files through the default export.";

const PACKAGE = "node_modules/@acme/lint";

const manifest = (exports: unknown) => JSON.stringify({ exports, name: "@acme/lint" });

const off = (group: string, rule: string) => ({ linter: { rules: { [group]: { [rule]: "off" } } } });

const configFiles = { includes: ["**/*.config.ts"], linter: { rules: { style: { noDefaultExport: "off" } } } };

const presetTexts = (preset: unknown, declarations?: unknown): Readonly<Record<string, string>> => ({
	[`${PACKAGE}/package.json`]: manifest({ "./biome": { biome: "./biome/biome.json", default: "./biome/other.json" } }),
	[`${PACKAGE}/biome/biome.json`]: JSON.stringify(preset),
	...(declarations === undefined ? {} : { [`${PACKAGE}/biome/declarations.json`]: JSON.stringify(declarations) }),
});

const consumer = (config: object) => JSON.stringify({ extends: ["@acme/lint/biome"], ...config }, null, "\t");

const check = async (texts: Readonly<Record<string, string>>, options?: Options, files?: ReadonlyArray<string>) =>
	(await checkRule(biomeOverrides, options, { files: files ?? [], texts })).map(
		(finding) => `${finding.file}${finding.line === undefined ? "" : `:${finding.line}`} ${finding.message}`,
	);

const withPreset = (preset: unknown, declarations: unknown, config: object, options?: Options) =>
	check({ ...presetTexts(preset, declarations), "biome.json": consumer(config) }, options);

const declaring = (rule: string, ...includes: readonly [string, ...string[]]): Options => ({ declared: [{ includes, reason, rule }] });

const shipped = [{ includes: ["**/*.config.ts"], reason, rule: "lint/style/noDefaultExport" }];

describe("suppressions/biome-overrides with a package preset", () => {
	it("takes a weakening the preset declares beside itself as declared", async () => {
		expect(await withPreset({ overrides: [configFiles] }, shipped, {})).toEqual([]);
	});

	it("reports a weakening the preset does not declare at the consumer's extends line", async () => {
		expect(await withPreset({ ...off("suspicious", "noConsole"), overrides: [configFiles] }, shipped, {})).toEqual([
			'biome.json:3 Extends "@acme/lint/biome", which weakens "lint/suspicious/noConsole" for "**" without a declaration.',
		]);
		expect(await withPreset({ overrides: [configFiles] }, undefined, {})).toEqual([
			'biome.json:3 Extends "@acme/lint/biome", which weakens "lint/style/noDefaultExport" for "**/*.config.ts" without a declaration.',
		]);
	});

	it("covers an undeclared preset weakening with the consumer's declaration", async () => {
		expect(await withPreset(off("suspicious", "noConsole"), undefined, {}, declaring("lint/suspicious/noConsole", "**"))).toEqual([]);
	});

	it("still needs a declaration for a weakening the consumer adds beyond the preset", async () => {
		const config = { overrides: [{ includes: ["scripts/**"], linter: { rules: { style: { noDefaultExport: "off" } } } }] };
		expect(await withPreset({ overrides: [configFiles] }, shipped, config)).toEqual([
			'biome.json:13 Weakens "lint/style/noDefaultExport" for "scripts/**" without a declaration.',
		]);
		expect(await withPreset({}, [], { linter: { rules: { suspicious: { noConsole: "warn" } } } })).toEqual([
			'biome.json:8 Weakens "lint/suspicious/noConsole" for "**" without a declaration.',
		]);
	});

	it.each([
		["a rule", off("suspicious", "noConsole"), { linter: { rules: { suspicious: { noConsole: "error" } } } }],
		["a rule, with a level", off("suspicious", "noConsole"), { linter: { rules: { suspicious: { noConsole: { level: "error" } } } } }],
		["a rule, through its whole group", off("suspicious", "noConsole"), { linter: { rules: { suspicious: "error" } } }],
		["the recommended rules", { linter: { rules: { recommended: false } } }, { linter: { rules: { recommended: true } } }],
		["the linter", { linter: { enabled: false } }, { linter: { enabled: true } }],
	])("lets the consumer turn %s the preset turned off back on", async (_, preset, config) => {
		expect(await withPreset(preset, [], config)).toEqual([]);
	});

	it("keeps the rest of a group the preset turned off when the consumer turns one of its rules on", async () => {
		const preset = { linter: { rules: { suspicious: "off" } } };
		expect(await withPreset(preset, [], off("suspicious", "noConsole"))).toEqual([
			'biome.json:3 Extends "@acme/lint/biome", which weakens "lint/suspicious" for "**" without a declaration.',
			'biome.json:8 Weakens "lint/suspicious/noConsole" for "**" without a declaration.',
		]);
		expect(await withPreset(preset, [], { linter: { rules: { suspicious: { noConsole: "error" } } } })).toHaveLength(1);
	});

	it("keeps the preset's files.includes next to the consumer's, since Biome appends the lists", async () => {
		const preset = { files: { includes: ["**", "!**/generated"] } };
		const declarations = [{ includes: ["**", "!**/generated"], reason: "Generated code is not source.", rule: "files/includes" }];
		expect(await withPreset(preset, declarations, { files: { includes: ["**", "!vendor"] } })).toEqual([
			'biome.json:6 Weakens "files/includes" for "**", "!vendor" without a declaration.',
		]);
		expect(await withPreset(preset, [], { files: { includes: ["**"] } })).toEqual([
			'biome.json:3 Extends "@acme/lint/biome", which weakens "files/includes" for "**", "!**/generated" without a declaration.',
		]);
		expect(await withPreset({ linter: { includes: ["src/**"] } }, [], { linter: { includes: ["**"] } })).toEqual([
			'biome.json:3 Extends "@acme/lint/biome", which weakens "lint/includes" for "src/**" without a declaration.',
		]);
	});

	it("reports a consumer declaration that repeats one the preset ships", async () => {
		expect(await withPreset({ overrides: [configFiles] }, shipped, {}, declaring("lint/style/noDefaultExport", "**/*.config.ts"))).toEqual([
			'biome.json Declares "lint/style/noDefaultExport" for "**/*.config.ts", which "@acme/lint/biome" already declares. Remove the declaration.',
		]);
	});

	it("does not report a shipped declaration whose weakening the consumer turned back on", async () => {
		const declarations = [{ includes: ["**"], reason, rule: "lint/suspicious/noConsole" }];
		expect(await withPreset(off("suspicious", "noConsole"), declarations, { linter: { rules: { suspicious: "on" } } })).toEqual([]);
	});

	it("scopes the preset and its declarations below a nested config that extends it", async () => {
		const texts = {
			...presetTexts({ overrides: [configFiles], ...off("suspicious", "noConsole") }, shipped),
			"biome.json": "{}",
			"apps/web/biome.json": consumer({ root: false }),
		};
		expect(await check(texts, undefined, ["apps/web/biome.json"])).toEqual([
			'apps/web/biome.json:3 Extends "@acme/lint/biome", which weakens "lint/suspicious/noConsole" for "apps/web/**" without a declaration.',
		]);
	});
});
