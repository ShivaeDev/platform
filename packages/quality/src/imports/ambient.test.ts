import { describe, expect, it } from "vitest";
import { ambientModules } from "#imports/ambient.ts";
import { sourceSyntax } from "#test/sourceSyntax.ts";

describe("ambient modules", () => {
	it("accepts an exact module declaration only in its declaring project", () => {
		const declared = ambientModules([{ path: "src/env.d.ts", syntax: sourceSyntax('declare module "virtual:config" {}') }]);
		expect(declared("virtual:config", new Set(["src/env.d.ts"]))).toBe(true);
		expect(declared("virtual:configuration", new Set(["src/env.d.ts"]))).toBe(false);
		expect(declared("virtual:config", new Set())).toBe(false);
	});
});
