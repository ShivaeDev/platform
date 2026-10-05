import { describe, expect, it } from "vitest";
import { noDoubleCast } from "#rules/suppressions/no-double-cast.ts";
import { checkRule } from "#test/inputs.ts";

const casts = async (content: string, path = "src/a.ts") =>
	(await checkRule(noDoubleCast, undefined, { sources: [{ content, path }] })).map((finding) => `${finding.line} ${finding.message}`);

describe("suppressions/no-double-cast fires", () => {
	it.each([
		["value as unknown as Target", "unknown"],
		["value as any as Target", "any"],
		["value as never as Target", "never"],
		["(value as unknown) as Target", "unknown"],
		["<Target>(<unknown>value)", "unknown"],
		["<Target>(value as any)", "any"],
		["(<unknown>value) as Target", "unknown"],
	])("on %s", async (expression, bridge) => {
		expect(await casts(`declare const value: string;\nexport const a = ${expression};\n`)).toEqual([
			`2 Casts through "${bridge}" to reach a type the value does not have.`,
		]);
	});

	it("on each double cast of a chain, at the line it starts", async () => {
		const content = "declare const value: string;\nexport const a = (\n\tvalue as unknown as First\n) as unknown as Second;\n";
		expect(await casts(content)).toEqual([
			'2 Casts through "unknown" to reach a type the value does not have.',
			'3 Casts through "unknown" to reach a type the value does not have.',
		]);
	});

	it("in TSX", async () => {
		expect(await casts("export const View = () => <div {...(props as unknown as Props)} />;\n", "src/view.tsx")).toHaveLength(1);
	});
});

describe("suppressions/no-double-cast stays quiet", () => {
	it.each([
		"value as unknown",
		"value as Target",
		"value as const",
		"value as Wide as Narrow",
		"value satisfies unknown",
		"(value as unknown) satisfies unknown",
	])("on %s", async (expression) => {
		expect(await casts(`declare const value: string;\nexport const a = ${expression};\n`)).toEqual([]);
	});

	it("on casts written in strings and comments, and on files it cannot parse", async () => {
		expect(await casts('export const a = "x as unknown as T"; // y as any as T\n')).toEqual([]);
		expect(await casts("a { color: red; }\n", "src/a.css")).toEqual([]);
	});
});
