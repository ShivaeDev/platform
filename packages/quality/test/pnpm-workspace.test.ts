import { describe, expect, it } from "vitest";
import { pnpmWorkspacePatterns } from "../src/imports/pnpm-workspace.ts";

describe("pnpmWorkspacePatterns", () => {
	it("reads a block list through comments at any column, quotes and trailing comments", () => {
		const text = [
			"# workspace",
			"packages:",
			"  - apps/*",
			"# libraries",
			"  - 'libs/*' # shared",
			'  - "tools/#build"',
			"",
			"  -   !**/fixtures/**",
			"catalog:",
			"  effect: 4.0.0",
		].join("\n");
		expect(pnpmWorkspacePatterns(text)).toEqual(["apps/*", "libs/*", "tools/#build", "!**/fixtures/**"]);
	});

	it("reads list items at column 0 and a flow list over several lines", () => {
		expect(pnpmWorkspacePatterns("packages:\n- apps/*\n- libs/*\n")).toEqual(["apps/*", "libs/*"]);
		expect(pnpmWorkspacePatterns("packages: [\n  apps/*, # apps\n  'libs/*',\n]\n")).toEqual(["apps/*", "libs/*"]);
	});

	it("reads a quoted packages key and quoted patterns with braces in a flow list", () => {
		expect(pnpmWorkspacePatterns('"packages":\n  - apps/*\n')).toEqual(["apps/*"]);
		expect(pnpmWorkspacePatterns("'packages': [\"apps/{web,admin}\", 'libs/*']\n")).toEqual(["apps/{web,admin}", "libs/*"]);
	});

	it("reads no packages when the file declares none", () => {
		expect(pnpmWorkspacePatterns("catalog:\n  effect: 4.0.0\n")).toEqual([]);
	});

	it("refuses packages it cannot read instead of dropping them", () => {
		expect(() => pnpmWorkspacePatterns("packages:\n  - apps/*\n  libs: true\n")).toThrow('pnpm-workspace.yaml: cannot read "libs: true" in packages');
		expect(() => pnpmWorkspacePatterns("packages: apps/*\n")).toThrow('pnpm-workspace.yaml: cannot read "apps/*" in packages');
		expect(() => pnpmWorkspacePatterns("packages: [apps/*\n")).toThrow("pnpm-workspace.yaml: the packages list never closes");
		expect(() => pnpmWorkspacePatterns("packages: [apps/{web,admin}]\n")).toThrow(
			'pnpm-workspace.yaml: cannot read "apps/{web" in packages; quote a pattern that holds { } [ ] or ,',
		);
	});
});
