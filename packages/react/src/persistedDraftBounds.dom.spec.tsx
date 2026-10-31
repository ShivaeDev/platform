import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { drafts, draftTyped, firstSessionDraft, persistedDraft, storedDraft } from "#test/draftStories.ts";

const week = 7 * 24 * 60 * 60 * 1000;

for (const maxAgeMs of [undefined, 1000]) {
	const limit = maxAgeMs ?? week;
	for (const [age, restored] of [
		[limit, true],
		[limit + 1, false],
	] as const) {
		drafts.it(
			`a draft aged ${age}ms ${restored ? "is restored" : "expires"} under ${maxAgeMs ? "a configured" : "the default"} ${limit}ms limit`,
			[draftTyped("name", "Old answer", maxAgeMs ? { key: "aged", maxAgeMs } : { key: "aged" })],
			function* ({ ageBy, fields, reload, stored }) {
				yield* ageBy(age);

				yield* reload();

				yield* outcomes({
					fields: [fields(), restored ? { name: "Old answer", quantity: "300" } : { name: "Paper", quantity: "300" }],
					stored: [stored(), restored ? { name: "Old answer", quantity: "300" } : "none"],
				});
			},
		);
	}
}

drafts.it(
	"a draft that grows past its UTF-8 byte limit is dropped without changing the input",
	[draftTyped("name", "a".repeat(120), { key: "bounded", maxBytes: 350 })],
	function* ({ fields, stored, type }) {
		yield* type("name", "é".repeat(120));

		yield* outcomes({
			name: [fields(), { name: "é".repeat(120), quantity: "300" }],
			stored: [stored(), "none"],
		});
	},
);

drafts.it("the default size limit drops an oversized draft without changing the input", [persistedDraft()], function* ({ nameLength, stored, type }) {
	yield* type("name", "a".repeat(256 * 1024));

	yield* outcomes({
		"name length": [nameLength(), 256 * 1024],
		stored: [stored(), "none"],
	});
});

for (const raw of [
	"{",
	"{}",
	JSON.stringify({
		baseline: { name: "Paper", quantity: "300" },
		edited: ["name"],
		session: "first",
		updatedAt: 0,
		values: { name: 42, quantity: "300" },
		version: 1,
	}),
]) {
	drafts.it(`a malformed or incompatible stored draft is dropped at mount (${raw})`, [storedDraft(raw)], function* ({ fields, open, stored }) {
		yield* open();

		yield* outcomes({
			fields: [fields(), { name: "Paper", quantity: "300" }],
			stored: [stored(), "none"],
		});
	});
}

drafts.it("a stored draft larger than the reading form's limit is dropped", [draftTyped("name", "First session")], function* ({ reload, stored }) {
	yield* reload({ key: "order-draft", maxBytes: 10 });

	expect(yield* stored()).toBe("none");
});

drafts.it("a draft another session stored is dropped at mount", [firstSessionDraft("stored")], function* ({ fields, open, stored }) {
	yield* open("second");

	yield* outcomes({
		fields: [fields(), { name: "Paper", quantity: "300" }],
		stored: [stored(), "none"],
	});
});
