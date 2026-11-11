import type { ResourceNames } from "#resource/names.ts";

export function resourceStory({ name }: ResourceNames) {
	return `import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn } from "#modules/${name}/test-support/application.ts";
import { answer } from "#test-support/answers.ts";

app.it("alice creates an item, lists it and persists it in PostgreSQL", [signedIn("alice")], function* ({ itemsOf, storedTitles }) {
	expect(yield* itemsOf("alice").list()).toEqual([]);

	const item = yield* itemsOf("alice").create("First item");

	expect(item.title).toBe("First item");
	yield* outcomes([
		["alice's list", () => itemsOf("alice").list(), [{ id: item.id, title: "First item" }]],
		["stored titles", () => storedTitles(), ["First item"]],
	]);
});

app.it("bob cannot list alice's items", [signedIn("alice"), signedIn("bob")], function* ({ itemsOf }) {
	yield* itemsOf("alice").create("Alice's private item");

	const listed = yield* itemsOf("bob").list();

	expect(listed).toEqual([]);
});

app.it("alice's open list receives her new item", [signedIn("alice")], function* ({ itemsOf, watchesList }) {
	const aliceList = yield* watchesList("alice");
	expect(yield* aliceList.nextUpdate()).toEqual([]);

	yield* itemsOf("alice").create("Alice's item");

	expect(yield* aliceList.nextUpdate()).toEqual(["Alice's item"]);
});

app.it(
	"bob's new item updates his open list and sends alice's none, so her next update carries her own item",
	[signedIn("alice"), signedIn("bob")],
	function* ({ itemsOf, watchesList }) {
		const aliceList = yield* watchesList("alice");
		const bobList = yield* watchesList("bob");
		expect(yield* aliceList.nextUpdate()).toEqual([]);
		expect(yield* bobList.nextUpdate()).toEqual([]);

		yield* itemsOf("bob").create("Bob's item");

		expect(yield* bobList.nextUpdate()).toEqual(["Bob's item"]);
		yield* itemsOf("alice").create("Alice's item");
		expect(yield* aliceList.nextUpdate()).toEqual(["Alice's item"]);
	},
);

app.it("a visitor cannot create items", [], function* ({ visitorClient }) {
	const client = yield* visitorClient();

	const replied = yield* answer(client["${name}.create"]({ title: "Anonymous item" }));

	expect(replied).toBe("sign in required");
});

app.it("a visitor cannot list items", [], function* ({ visitorClient }) {
	const client = yield* visitorClient();

	const replied = yield* answer(client["${name}.list"]());

	expect(replied).toBe("sign in required");
});
`;
}
