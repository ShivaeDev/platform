import { expect } from "vitest";
import { prisma } from "#test/prisma.ts";
import { twoPackageCopies } from "#test/prismaTraits.ts";

prisma.it("bindings with the same name from two copies of the package keep their clients apart", [twoPackageCopies()], function* ({ bindings }) {
	expect(yield* bindings.clientFromOtherCopy).toBe(bindings.client);
});
