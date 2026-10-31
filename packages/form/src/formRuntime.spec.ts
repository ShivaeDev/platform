import { expect } from "@effect/vitest";
import { nativeNames } from "#test/lifecycle.ts";

nativeNames.it("native atom services are available without a supplied runtime", [], function* ({ savedValue, submit }) {
	yield* submit();

	expect(yield* savedValue()).toEqual({ name: "First" });
});
