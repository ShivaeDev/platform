import { expect, it } from "vitest";
import { conditionalKit } from "#test/conditionalKit.ts";

const { executed, given, kit } = conditionalKit(true);

function body({ recordsBody }: { readonly recordsBody: () => undefined }) {
	return recordsBody();
}

kit.it("plain", given, body);
kit.it.fails("fails", given, ({ recordsBody }) => {
	recordsBody();
	throw new Error("intentional story failure");
});
kit.it.skip("skip", given, body);
kit.it.runIf(true)("runIf true", given, body);
kit.it.runIf(false)("runIf false", given, body);
kit.it.skipIf(false)("skipIf false", given, body);
kit.it.skipIf(true)("skipIf true", given, body);

it("runs setup and body for each enabled story", () => {
	expect(executed).toEqual(["layer", ...Array.from({ length: 4 }, () => ["around", "create", "trait", "body"]).flat()]);
});
