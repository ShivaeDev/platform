import { expect } from "vitest";
import { settlingPage } from "#test/settlingPage.tsx";

for (const title of ["First story's page", "Second story's page"]) {
	settlingPage.it(`a fresh app saves ${title} without inheriting another story's state`, [], function* ({ settle, drafts, text, enter, click }) {
		yield* settle();
		expect(yield* drafts()).toEqual([""]);
		expect(text("output")).toBe("First page");
		yield* enter("input", title);

		yield* click({ name: "Save", role: "button" });
		yield* settle();

		expect(text("output")).toBe(title);
	});
}
