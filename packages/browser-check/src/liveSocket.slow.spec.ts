import { expect } from "vitest";
import { liveSocket } from "#test/liveSocket.ts";

liveSocket.it("a starter page's first live result contains a previously saved note", [], function* ({ addsNote, freshTitle, nextList, visits }) {
	const title = yield* freshTitle();
	yield* addsNote(title);

	yield* visits();

	expect(yield* nextList()).toContain(title);
});

liveSocket.it(
	"a starter page receives a change hint and displays a note after another browser saves it",
	[],
	function* ({ addsNote, checksText, freshTitle, nextChange, nextList, visits }) {
		const title = yield* freshTitle();
		yield* visits();
		expect(yield* nextList()).not.toContain(title);

		yield* addsNote(title);

		expect(yield* nextChange()).toContain('"collection":"notes"');
		yield* checksText(title);
	},
);
