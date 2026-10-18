import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { drafts, persistedDraft, storedDraft } from "#test/draftStories.ts";

for (const maxAgeMs of [undefined, 1000]) {
	drafts.it(
		`expires drafts after the default or configured age (${maxAgeMs})`,
		[persistedDraft(maxAgeMs === undefined ? { key: "aged" } : { key: "aged", maxAgeMs })],
		function* ({ type, reload, draft, advanceAgeBy }) {
			yield* type("name", "Old answer");
			expect(window.localStorage.getItem("aged")).not.toBeNull();
			advanceAgeBy((maxAgeMs ?? 7 * 24 * 60 * 60 * 1000) + 1);
			yield* reload();
			expect(draft().editor().form.values.value.name).toBe("Paper");
			expect(window.localStorage.getItem("aged")).toBeNull();
		},
	);
}

drafts.it(
	"bounds the full record by UTF-8 bytes and drops a draft that grows too large",
	[persistedDraft({ key: "bounded", maxBytes: 350 })],
	function* ({ type, draft }) {
		yield* type("name", "a".repeat(120));
		expect(window.localStorage.getItem("bounded")).not.toBeNull();
		yield* type("name", "é".repeat(120));
		expect(window.localStorage.getItem("bounded")).toBeNull();
		expect(draft().editor().form.values.value.name).toBe("é".repeat(120));
	},
);

drafts.it("the default size limit drops oversized drafts without changing input", [persistedDraft()], function* ({ type, draft }) {
	yield* type("name", "a".repeat(256 * 1024));
	expect(window.localStorage.getItem("order-draft")).toBeNull();
	expect(draft().editor().form.values.value.name).toHaveLength(256 * 1024);
});

for (const raw of [
	"{",
	"{}",
	JSON.stringify({
		baseline: { name: "Paper", quantity: "300" },
		edited: ["name"],
		session: "first",
		updatedAt: Effect.runSync(Clock.currentTimeMillis),
		values: { name: 42, quantity: "300" },
		version: 1,
	}),
]) {
	drafts.it(`drops malformed or incompatible input at mount (${raw})`, [storedDraft(raw), persistedDraft()], ({ draft }) => {
		expect(draft().editor().form.values.value.name).toBe("Paper");
		expect(window.localStorage.getItem("order-draft")).toBeNull();
	});
}

drafts.it(
	"drops oversized records on read and drafts from another session",
	[persistedDraft()],
	function* ({ type, reload, show, draft, storeDraft }) {
		yield* type("name", "First session");
		const raw = window.localStorage.getItem("order-draft");
		yield* reload({ key: "order-draft", maxBytes: 10 });
		expect(window.localStorage.getItem("order-draft")).toBeNull();
		storeDraft(raw ?? "");
		yield* reload();
		yield* show("second");
		expect(draft().editor().form.values.value.name).toBe("Paper");
		expect(window.localStorage.getItem("order-draft")).toBeNull();
	},
);
