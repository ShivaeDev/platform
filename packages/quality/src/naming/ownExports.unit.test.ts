import { describe, expect, it } from "vitest";
import { ownExports } from "#naming/ownExports.ts";
import { sourceSyntax } from "#test/sourceSyntax.ts";

describe("ownExports", () => {
	it("marks a signed literal as a constant and a declared value without an initializer as not one", () => {
		expect(ownExports(sourceSyntax("export const offset = -1;\nexport declare const connection: object;"))).toEqual([
			{ constant: true, kind: "value", name: "offset" },
			{ constant: false, kind: "value", name: "connection" },
		]);
	});

	it("keeps type-only and renamed local exports and leaves out re-exports and exported imports", () => {
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

		expect(ownExports(sourceSyntax(source))).toEqual([
			{ constant: false, kind: "type", name: "Connection" },
			{ constant: false, kind: "value", name: "open" },
		]);
	});

	it.each([
		["export default memo(function Card() {});", "Card"],
		["export default wrap(class Store {});", "Store"],
		["function Card() {}\nexport default (Card as Component);", "Card"],
		["function Card() {}\nexport default (Card satisfies Component);", "Card"],
	])("names a default export after the function or class it wraps in %s", (text, name) => {
		expect(ownExports(sourceSyntax(text))).toEqual([{ constant: false, kind: "value", name }]);
	});
});
