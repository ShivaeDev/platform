import { describe, expect, it } from "vitest";
import { ambientModules } from "#imports/ambient.ts";
import { sourceSyntax } from "#test/sourceSyntax.ts";

const declared = ambientModules([{ path: "src/env.d.ts", syntax: sourceSyntax('declare module "virtual:config" {}') }]);

describe("ambient modules", () => {
	it("declares a module for its exact name in its declaring project", () => {
		expect(declared("virtual:config", new Set(["src/env.d.ts"]))).toBe(true);
	});

	it("declares no module for a longer name that starts with the declared one", () => {
		expect(declared("virtual:configuration", new Set(["src/env.d.ts"]))).toBe(false);
	});

	it("declares no module in a project that does not hold the declaration", () => {
		expect(declared("virtual:config", new Set())).toBe(false);
	});
});
