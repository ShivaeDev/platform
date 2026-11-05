import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { ownExports } from "#naming/ownExports.ts";
import { sourceSyntax } from "#test/sourceSyntax.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

describe("ownExports", () => {
	it.effect("marks a signed literal as a constant and a declared value without an initializer as not one", function* () {
		yield* assertThat(ownExports(sourceSyntax("export const offset = -1;\nexport declare const connection: object;")), (actual) =>
			actual.toEqual([
				{ constant: true, kind: "value", name: "offset" },
				{ constant: false, kind: "value", name: "connection" },
			]),
		);
	});

	it.effect("keeps type-only and renamed local exports and leaves out re-exports and exported imports", function* () {
		const source = [
			"class Connection {}",
			"function connect() {}",
			"export type { Connection };",
			"export { connect as open };",
			'export * from "remote";',
			'export { Remote } from "remote";',
			'import { Imported } from "remote";',
			"export { Imported };",
		].join("\n");

		yield* assertThat(ownExports(sourceSyntax(source)), (actual) =>
			actual.toEqual([
				{ constant: false, kind: "type", name: "Connection" },
				{ constant: false, kind: "value", name: "open" },
			]),
		);
	});

	it.effect.each([
		["export default memo(function Card() {});", "Card"],
		["export default wrap(class Store {});", "Store"],
		["function Card() {}\nexport default (Card as Component);", "Card"],
		["function Card() {}\nexport default (Card satisfies Component);", "Card"],
	] satisfies ReadonlyArray<readonly [unknown, unknown]>)(
		"names a default export after the function or class it wraps in %s",
		function* ([text, name]) {
			yield* assertThat(ownExports(sourceSyntax(text)), (actual) => actual.toEqual([{ constant: false, kind: "value", name }]));
		},
	);
});
