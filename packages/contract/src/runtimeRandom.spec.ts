import { expect } from "vitest";
import { runtimeRandom } from "#test/runtimeRandom.ts";

runtimeRandom.it("a seeded runtime gives the live server a stable resync identity", [], function* ({ invalidatedKeys, resync }) {
	yield* resync();

	expect(invalidatedKeys()).toEqual([["@shivaedev/contract/resync/-7116713049603681"]]);
});
