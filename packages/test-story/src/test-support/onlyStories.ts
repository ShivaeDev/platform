import { afterAll, expect } from "vitest";
import { conditionalKit } from "#test/conditionalKit.ts";

const { executed, given, kit } = conditionalKit(true);
const focused = kit.it.only;

focused("focused", given, ({ recordsBody }) => recordsBody());
kit.it("plain", given, ({ recordsBody }) => recordsBody());

afterAll(() => {
	expect(executed).toEqual(["layer", "around", "create", "trait", "body"]);
});
