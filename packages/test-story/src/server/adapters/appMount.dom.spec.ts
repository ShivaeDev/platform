import { expect } from "vitest";
import { settlingPage } from "#test/settlingPage.tsx";

for (const title of ["First story's page", "Second story's page"]) {
	settlingPage.it(`a fresh app saves ${title} without inheriting another story's state`, [], function* ({ settle, drafts, text, save }) {
		yield* settle();
		expect(yield* drafts()).toEqual([""]);
		expect(text("output")).toBe("First page");

		yield* save(title);

		expect(text("output")).toBe(title);
	});
}
