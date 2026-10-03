import { describe, expect, it } from "vitest";
import { biomeOverrides } from "../src/rules/suppressions/biome-overrides.ts";
import { checkRule } from "./support/inputs.ts";

const PACKAGE = "node_modules/@acme/lint";

const weak = (rule: string) => JSON.stringify({ linter: { rules: { suspicious: { [rule]: "off" } } } });

const extending = (...entries: ReadonlyArray<string>) => JSON.stringify({ extends: entries });

const found = async (texts: Readonly<Record<string, string>>) =>
	(await checkRule(biomeOverrides, undefined, { texts })).map(
		(finding) => `${finding.file}${finding.line === undefined ? "" : `:${finding.line}`} ${finding.message}`,
	);

const resolvedRule = async (specifier: string, manifest: object, files: Readonly<Record<string, string>>) =>
	(
		await found({
			"biome.json": extending(specifier),
			[`${PACKAGE}/package.json`]: JSON.stringify({ name: "@acme/lint", ...manifest }),
			...Object.fromEntries(Object.entries(files).map(([path, text]) => [`${PACKAGE}/${path}`, text])),
		})
	).map((line) => /weakens "lint\/suspicious\/(\w+)"/.exec(line)?.[1] ?? line);

describe("suppressions/biome-overrides resolves an extends entry", () => {
	it.each([
		["through an exports condition Biome accepts", "@acme/lint/biome", { exports: { "./biome": { import: "./a.json", default: "./b.json" } } }, "b"],
		["through the first accepted condition", "@acme/lint/biome", { exports: { "./biome": { biome: "./a.json", default: "./b.json" } } }, "a"],
		["through an exports pattern", "@acme/lint/strict", { exports: { "./*": "./configs/*.json", "./str*": "./a.json" } }, "a"],
		["through a string exports", "@acme/lint", { exports: "./b.json" }, "b"],
		["through conditions at the top of exports", "@acme/lint", { exports: { default: "./a.json" } }, "a"],
		["through main without exports", "@acme/lint", { main: "b.json" }, "b"],
		["as a file in a package without exports", "@acme/lint/configs/strict.json", {}, "strict"],
	])("%s", async (_, specifier, manifest, rule) => {
		const files = { "a.json": weak("a"), "b.json": weak("b"), "configs/strict.json": weak("strict") };
		expect(await resolvedRule(specifier, manifest, files)).toEqual([rule]);
	});

	it("through the repository's own package.json exports", async () => {
		const texts = {
			"biome.json": extending("@acme/app/lint"),
			"package.json": JSON.stringify({ exports: { "./lint": "./lint.json" }, name: "@acme/app" }),
		};
		expect(await found({ ...texts, "lint.json": weak("own") })).toEqual([
			'biome.json:1 Extends "@acme/app/lint", which weakens "lint/suspicious/own" for "**" without a declaration.',
		]);
	});

	it("as a path from the repository root when it names a file there", async () => {
		expect(await found({ "biome.json": extending("configs/base.json"), "configs/base.json": weak("base") })).toEqual([
			'configs/base.json:1 Weakens "lint/suspicious/base" for "**" without a declaration.',
		]);
	});

	it("without following the extends of a config it extends, as Biome does", async () => {
		const texts = {
			"biome.json": extending("./base.json", "@acme/lint"),
			"base.json": JSON.stringify({ extends: ["./deeper.json"] }),
			"deeper.json": weak("deeper"),
			[`${PACKAGE}/package.json`]: JSON.stringify({ exports: "./biome.json" }),
			[`${PACKAGE}/biome.json`]: JSON.stringify({ extends: ["./inner.json"] }),
			[`${PACKAGE}/inner.json`]: weak("inner"),
		};
		expect(await found(texts)).toEqual([]);
	});
});

describe("suppressions/biome-overrides reports at the extends line", () => {
	it.each([
		["a package that is not installed", {}, 'Cannot resolve the Biome config "@acme/lint/biome" from node_modules.'],
		[
			"a subpath the package does not export",
			{ [`${PACKAGE}/package.json`]: JSON.stringify({ exports: { "./other": "./other.json" } }) },
			"Cannot resolve",
		],
		["an export outside the package", { [`${PACKAGE}/package.json`]: JSON.stringify({ exports: { "./biome": "../x.json" } }) }, "Cannot resolve"],
		[
			"an exported file that does not exist",
			{ [`${PACKAGE}/package.json`]: JSON.stringify({ exports: { "./biome": "./biome.json" } }) },
			'Cannot read the Biome config "@acme/lint/biome" at node_modules/@acme/lint/biome.json: the file does not exist.',
		],
		[
			"invalid declarations beside the preset",
			{
				[`${PACKAGE}/package.json`]: JSON.stringify({ exports: { "./biome": "./biome/biome.json" } }),
				[`${PACKAGE}/biome/biome.json`]: "{}",
				[`${PACKAGE}/biome/declarations.json`]: JSON.stringify([{ includes: ["**"], reason: " ", rule: "lint/style" }]),
			},
			'Cannot read the declarations shipped with "@acme/lint/biome" at node_modules/@acme/lint/biome/declarations.json:',
		],
	])("%s", async (_, files, message) => {
		expect(await found({ "biome.json": '{\n\t"extends": [\n\t\t"@acme/lint/biome"\n\t]\n}', ...files })).toEqual([
			expect.stringContaining(`biome.json:3 ${message}`),
		]);
	});
});
