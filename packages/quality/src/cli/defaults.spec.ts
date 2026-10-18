import { afterEach, describe, expect, it } from "vitest";
import { CLI_EXIT, quality } from "#test/cli.ts";
import { defaultTree, removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("quality without a config", { timeout: 60_000 }, () => {
	it("lints and fixes with the shared defaults", () => {
		const root = defaultTree();
		expect(quality(root, "fix").status).toBe(CLI_EXIT.passed);
		expect(quality(root)).toMatchObject({ status: 0, stdout: expect.stringContaining("quality: passed.") });
	});

	it("fails for uncovered findings and can record and prune existing debt", () => {
		const root = defaultTree({ content: "// TODO\nexport function value(): number {\n\treturn 1;\n}\n", path: "src/value.ts" });
		expect(quality(root, "lint")).toMatchObject({ status: 1, stdout: expect.stringContaining("comments/no-todo") });
		expect(quality(root, "baseline", "write").status).toBe(CLI_EXIT.passed);
		expect(quality(root, "lint").status).toBe(CLI_EXIT.passed);
		expect(quality(root, "baseline", "prune").status).toBe(CLI_EXIT.passed);
	});

	it("rejects an explicitly selected missing config", () => {
		const result = quality(defaultTree(), "lint", "--config", "missing.ts");
		expect(result.status).toBe(CLI_EXIT.invalid);
		expect(result.stderr).toContain("Check the --config path");
	});
});
