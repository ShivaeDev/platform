import { expect } from "vitest";
import { database } from "#test/database.ts";

database.it("application finalizers finish while the isolated database scope is still open", [], function* ({ closeApplication }) {
	expect(yield* closeApplication()).toEqual([{ rows: [{ available: 1 }], scope: "Open" }]);
});
