import { expect } from "vitest";
import { stylesheets } from "#test-support/stylesheets.ts";

for (const mode of ["development", "production"] as const) {
	stylesheets.it(`${mode} CSS includes utilities used only by a module client`, [], function* ({ compile, css }) {
		yield* compile(mode);
		// The matcher must not become a Tailwind utility candidate itself.
		const utility = ["text", "code", "added"].join("-");
		expect(css()).toMatch(new RegExp(String.raw`\.${utility}\s*\{[^}]*color:\s*var\(--code-added\)`, "u"));
	});
}
