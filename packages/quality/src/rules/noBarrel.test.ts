import { describe, expect, it } from "vitest";
import { checkRule } from "#test/inputs.ts";
import { noBarrel } from "./noBarrel.ts";

describe("structure/no-barrel", () => {
	it.each(["src/index.ts", "src/nested/index.tsx"])("rejects %s even when it defines its own exports", async (path) => {
		expect(await checkRule(noBarrel, undefined, { sources: [{ content: "export function index() { return 1; }", path }] })).toEqual([
			{ file: path, message: expect.stringContaining("Name the module after its purpose") },
		]);
	});
	it("accepts purpose-named modules and declarations", async () => {
		expect(
			await checkRule(noBarrel, undefined, { sources: ["src/read.ts", "src/indexed.tsx", "src/index.d.ts"].map((path) => ({ content: "", path })) }),
		).toEqual([]);
	});
});
