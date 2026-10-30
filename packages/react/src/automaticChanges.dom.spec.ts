import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { automatic } from "#test/automatic/automatic.ts";

expectNoReactWarnings();

automatic.it(
	"a worker commit refreshes the session's live query without app wiring; rollback and unrelated items do not refetch it",
	[],
	function* ({ note, reads, workerWrite, publications, notifications, settle, ready }) {
		yield* eventually(() => {
			expect(ready()).toBe(true);
			expect(note(1)).toBe("First");
			expect(note(2)).toBe("Second");
		});
		yield* settle();
		const secondReads = reads().filter((id) => id === 2).length;
		expect(yield* workerWrite(1, "From worker")).toMatchObject({ _tag: "Handled", result: "Success" });
		yield* eventually(() => expect(note(1)).toBe("From worker"));
		expect(note(2)).toBe("Second");
		expect(reads().filter((id) => id === 2)).toHaveLength(secondReads);
		expect(publications()).toEqual(["notes", "notes:1"]);
		expect(notifications()).toEqual([["notes", "notes:1"]]);
		const before = reads();
		expect(yield* workerWrite(1, "Rolled back", true)).toMatchObject({ _tag: "Handled", result: "Failure" });
		yield* settle();
		expect(note(1)).toBe("From worker");
		expect(reads()).toEqual(before);
		expect(publications()).toEqual(["notes", "notes:1"]);
		expect(notifications()).toEqual([["notes", "notes:1"]]);
	},
);

automatic.it(
	"a command publishes declared derived keys once without repeating repository keys",
	[],
	function* ({ note, rename, publications, notifications, settle, ready }) {
		yield* eventually(() => {
			expect(ready()).toBe(true);
			expect(note(1)).toBe("First");
		});
		expect(yield* rename(1, "From command")).toMatchObject({ id: 1, title: "From command" });
		yield* eventually(() => expect(note(1)).toBe("From command"));
		yield* settle();
		expect(publications()).toEqual(["notes", "notes:1", "summary"]);
		expect(notifications().flat()).toEqual(["notes", "notes:1", "summary"]);
	},
);
