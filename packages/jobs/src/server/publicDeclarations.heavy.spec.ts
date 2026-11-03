import { expect } from "vitest";
import { declarations } from "#test/declarations.ts";

declarations.it("every emitted declaration typechecks without resolving pg-boss types", [], function* ({ compile }) {
	expect(yield* compile()).toEqual([]);
});
