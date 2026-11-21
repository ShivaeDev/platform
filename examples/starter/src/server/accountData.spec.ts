import { expect } from "vitest";
import { ownedData } from "#test-support/ownedData.ts";

ownedData.it(
	"on the migrated database, the owned models that the real application host collects cover each column that refers to a person, so an account export or erase leaves none out",
	[],
	function* ({ coverage }) {
		const covered = yield* coverage();

		expect(covered).toBe("covered");
	},
);
