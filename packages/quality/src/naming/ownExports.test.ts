import { describe, expect, it } from "vitest";
import { ownExports } from "#naming/ownExports.ts";
import { sourceSyntax } from "#test/sourceSyntax.ts";

describe("own exports", () => {
	it("recognizes signed literal constants and declared values without an initializer", () => {
		expect(ownExports(sourceSyntax("export const offset = -1;\nexport declare const connection: object;"))).toEqual([
			{ constant: true, kind: "value", name: "offset" },
			{ constant: false, kind: "value", name: "connection" },
		]);
	});

	it("preserves type-only and renamed local exports without naming reexports after the importer", () => {
		expect(
			ownExports(
				sourceSyntax(
					'class Connection {}\nfunction connect() {}\nexport type { Connection };\nexport { connect as open };\nexport * from "remote";\nexport { Remote } from "remote";\nimport { Imported } from "remote";\nexport { Imported };',
				),
			),
		).toEqual([
			{ constant: false, kind: "type", name: "Connection" },
			{ constant: false, kind: "value", name: "open" },
		]);
	});

	it.each([
		["export default memo(function Card() {});", "Card"],
		["export default wrap(class Store {});", "Store"],
		["function Card() {}\nexport default (Card as Component);", "Card"],
		["function Card() {}\nexport default (Card satisfies Component);", "Card"],
	])("finds the public name through a wrapped expression %s", (text, name) => {
		expect(ownExports(sourceSyntax(text))).toEqual([{ constant: false, kind: "value", name }]);
	});
});
