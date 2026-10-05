import { describe, expect, it } from "vitest";
import { maxLines } from "#rules/max-lines.ts";
import { checkRule, issuesOf } from "#test/inputs.ts";
import { lines } from "#test/tree.ts";

const source = (path: string, count: number) => ({ content: lines(count), path });

describe("structure/max-lines fires", () => {
	it("on a source file over 150 lines, counting the lines above the limit", async () => {
		const findings = await checkRule(maxLines, undefined, { sources: [source("src/big.ts", 168)] });
		expect(findings).toEqual([{ count: 18, file: "src/big.ts", message: "168 lines exceeds the 150-line limit.", threshold: 150 }]);
	});

	it("on a test file over 300 lines, wherever tests live", async () => {
		const paths = ["src/a.test.ts", "src/b.spec.tsx", "packages/x/test/support.ts", "tests/e2e.ts", "src/__tests__/c.ts"];
		const findings = await checkRule(maxLines, undefined, { sources: paths.map((path) => source(path, 301)) });
		expect(findings.map((finding) => finding.file)).toEqual(paths);
		expect(findings.every((finding) => finding.message.includes("300-line limit"))).toBe(true);
	});

	it("at the configured limits", async () => {
		const findings = await checkRule(maxLines, { source: 100, test: 120 }, { sources: [source("src/a.ts", 101), source("src/a.test.ts", 121)] });
		expect(findings.map((finding) => finding.message)).toEqual(["101 lines exceeds the 100-line limit.", "121 lines exceeds the 120-line limit."]);
	});

	it("on a file the configured test patterns no longer treat as a test", async () => {
		const findings = await checkRule(maxLines, { testFiles: ["e2e/"] }, { sources: [source("src/a.test.ts", 151), source("e2e/flow.ts", 151)] });
		expect(findings.map((finding) => finding.file)).toEqual(["src/a.test.ts"]);
	});

	it("counts a final line without a newline", async () => {
		const findings = await checkRule(maxLines, { source: 2 }, { sources: [{ content: "a\nb\nc", path: "src/a.ts" }] });
		expect(findings[0]?.count).toBe(1);
	});
});

describe("structure/max-lines stays quiet", () => {
	it("at exactly the limit, counting lines the way an editor does", async () => {
		expect(await checkRule(maxLines, undefined, { sources: [source("src/full.ts", 150), source("src/full.test.ts", 300)] })).toEqual([]);
	});

	it("on declaration files", async () => {
		const paths = ["src/contract.d.ts", "src/module.d.mts", "src/common.d.cts"];
		expect(await checkRule(maxLines, undefined, { sources: paths.map((path) => source(path, 400)) })).toEqual([]);
	});

	it("on an empty file", async () => {
		expect(await checkRule(maxLines, { source: 1 }, { sources: [{ content: "", path: "src/empty.ts" }] })).toEqual([]);
	});
});

describe("structure/max-lines options", () => {
	it("reject a misspelled option", async () => {
		expect(await issuesOf(maxLines, { sourc: 100 })).toEqual([expect.stringContaining("sourc")]);
	});

	it("reject a limit that is not a positive integer", async () => {
		expect(await issuesOf(maxLines, { source: 0, test: 1.5 })).toHaveLength(2);
	});

	it("reject test patterns that are not strings", async () => {
		expect(await issuesOf(maxLines, { testFiles: [1] })).toEqual([expect.stringContaining("testFiles")]);
	});
});
