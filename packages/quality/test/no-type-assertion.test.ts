import { describe, expect, it } from "vitest";
import { noTypeAssertion } from "../src/rules/suppressions/no-type-assertion.ts";
import { checkRule, issuesOf } from "./support/inputs.ts";

type Options = Parameters<typeof noTypeAssertion.configure>[0];

const reason = "The generated client returns untyped rows that the generator's own schema already checked.";

const found = async (files: Readonly<Record<string, string>>, options?: Options) =>
	(await checkRule(noTypeAssertion, options, { sources: Object.entries(files).map(([path, content]) => ({ content, path })) })).map(
		(finding) => `${finding.file}${finding.line === undefined ? "" : `:${finding.line}`} ${finding.message}`,
	);

const expression = (text: string, path = "src/a.ts") => found({ [path]: `declare const value: string;\nexport const a = ${text};\n` });

describe("suppressions/no-type-assertion fires", () => {
	it.each([
		["value as Target", "Target"],
		["value as unknown", "unknown"],
		["<Target>value", "Target"],
		["(value as Wide) as Narrow", "Narrow"],
		["value as Record<string, number>", "Record<string, number>"],
	])("on %s", async (text, type) => {
		expect(await expression(text)).toContain(`src/a.ts:2 Asserts the type "${type}" instead of proving it.`);
	});

	it("on every single cast of a chain, and in TSX", async () => {
		expect(await expression("(value as Wide) as Narrow")).toHaveLength(2);
		expect(await found({ "src/view.tsx": "export const View = () => <div {...(props as Props)} />;\n" })).toEqual([
			'src/view.tsx:1 Asserts the type "Props" instead of proving it.',
		]);
	});
});

describe("suppressions/no-type-assertion stays quiet", () => {
	it.each([
		"value as const",
		"<const>[1, 2]",
		"{ kind: 'a' } satisfies { kind: string }",
		"value as unknown as Target",
		"value as any as Target",
		"(value as never) as Target",
	])("on %s", async (text) => {
		expect(await expression(text)).toEqual([]);
	});

	it("on casts written in strings and comments, and on files it cannot parse", async () => {
		expect(await found({ "src/a.css": "a { color: red; }\n", "src/a.ts": 'export const a = "x as T"; // y as T\n' })).toEqual([]);
	});
});

describe("suppressions/no-type-assertion declarations", () => {
	const files = { "src/generated/client.ts": "export const rows = query() as Row[];\n", "src/app.ts": "export const user = load() as User;\n" };
	const declared = (...includes: readonly [string, ...string[]]) => ({ declared: [{ includes, reason }] });

	it("allow every assertion in the files they include", async () => {
		expect(await found(files, declared("src/generated/"))).toEqual(['src/app.ts:1 Asserts the type "User" instead of proving it.']);
	});

	it("go stale when their files have no assertion left", async () => {
		expect(await found(files, declared("src/legacy/**"))).toEqual([
			'src/generated/client.ts:1 Asserts the type "Row[]" instead of proving it.',
			'src/app.ts:1 Asserts the type "User" instead of proving it.',
			'quality.config.ts Declares type assertions for "src/legacy/**", which match none. Remove the declaration.',
		]);
	});

	it.each([
		["a blank reason", { declared: [{ includes: ["src/a.ts"], reason: " " }] }, "reason"],
		["no includes", { declared: [{ includes: [], reason }] }, "includes"],
		["an unknown field", { declared: [{ includes: ["src/a.ts"], reason, rule: "x" }] }, "rule"],
	])("reject %s", async (_, options, field) => {
		expect(await issuesOf(noTypeAssertion, options)).toEqual([expect.stringContaining(field)]);
	});
});
