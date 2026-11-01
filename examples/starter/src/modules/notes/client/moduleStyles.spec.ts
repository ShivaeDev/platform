import { expect } from "vitest";
import { stylesheets } from "#test-support/stylesheets.ts";

for (const mode of ["development", "production"] as const) {
	stylesheets.it(`the ${mode} stylesheet includes the code-added utility that only a module client uses`, [], function* ({ compile, ruleFor }) {
		yield* compile(mode);

		expect(ruleFor("code-added")).toMatch(/color:\s*var\(--code-added\)/v);
	});
}
