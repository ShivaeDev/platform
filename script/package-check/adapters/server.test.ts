import { expect } from "vitest";
import { archives } from "#package-check/test-support/archives.ts";
import { unrelatedBrowserClient } from "#package-check/test-support/exportTraits.ts";

archives.it("rejects unrelated JavaScript in place of the packed Board browser client", [unrelatedBrowserClient], function* ({ server }) {
	expect(yield* server()).toBe("Packed server request failed: /_board/react.js");
});
