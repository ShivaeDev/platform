import { expect, it } from "vitest";
import { conditionalKit } from "#test/conditionalKit.ts";

const { executed, given, kit } = conditionalKit(false);
const focused = kit.it.only;

function body({ recordsBody }: { readonly recordsBody: () => undefined }) {
	return recordsBody();
}

kit.it("plain", given, body);
kit.it.fails("fails", given, body);
focused("only", given, body);
kit.it.skip("skip", given, body);
kit.it.runIf(true)("runIf true", given, body);
kit.it.runIf(false)("runIf false", given, body);
kit.it.skipIf(false)("skipIf false", given, body);
kit.it.skipIf(true)("skipIf true", given, body);

it("never acquires the layer or runs around, creation, traits or bodies", () => {
	expect(executed).toEqual([]);
});
