import { expect, it } from "vitest";
import { identities, workspace } from "./keys.ts";
import { pageKeys } from "./pageKeys.ts";

it.each(["", "/"])("tracks the same item identity with trailing suffix '%s'", (slash) => {
	expect(pageKeys(`/_board/item/task.fixture${slash}`)).toEqual([workspace.list, identities.item("task.fixture")]);
});
