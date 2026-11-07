import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { asciiFix } from "#test/asciiFix.ts";

asciiFix.it(
	"quality fix replaces configured characters and reports message-only characters for rewording",
	[],
	function* ({ fix, message, outcome, source }) {
		yield* fix();

		yield* outcomes([
			["replaced text", () => source(), '"hello" ... hidden keep \u2192 Caf\u00e9 \u2014\n'],
			["manual message", () => message(), expect.stringContaining("Reword this without an em dash.")],
			["fix outcome", () => outcome(), "rejected"],
		]);
	},
);
