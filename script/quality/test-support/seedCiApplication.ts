import { mkdirSync, realpathSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { writes } from "#quality-fixtures/hookRepository.ts";
import { linkPackage } from "#quality-fixtures/tree.ts";

const load = createRequire(import.meta.url);

export function seedCiApplication(root: string, failing: boolean): void {
	linkPackage(root);
	symlinkSync(dirname(realpathSync(load.resolve("vitest/package.json"))), join(root, "node_modules/vitest"));
	mkdirSync(join(root, "src"));
	writes(root, "src/double.ts", "export const double = (value: number) => value * 2;\n");
	writes(root, "src/unvisited.ts", "export const unvisited = () => 42;\n");
	writes(
		root,
		"vitest.config.ts",
		'import { appTestConfig } from "@shivaedev/quality/appTestConfig.ts";\nexport default appTestConfig(["source"], { coverage: { enabled: false, include: ["src/double.ts"] } });\n',
	);
	writes(
		root,
		"src/double.test.ts",
		`import { appendFileSync } from "node:fs";
import { expect, it } from "vitest";
import { double } from "./double.ts";
it("measures doubling", () => {
  appendFileSync("tests.log", "measured\\n");
  expect(double(3)).toBe(${failing ? 7 : 6});
});
`,
	);
}
