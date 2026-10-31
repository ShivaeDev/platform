import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { runtimeRandom } from "#test/runtimeRandom.ts";

runtimeRandom.it("a seeded runtime gives the live server a stable resync identity", [], function* ({ invalidatedKeys, resync }) {
	yield* resync();

	yield* outcomes({ "the invalidated keys": [invalidatedKeys(), [["@shivaedev/contract/resync/-7116713049603681"]]] });
});
