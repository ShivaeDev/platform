import { expect } from "vitest";
import { privateSessionsAcrossHosts, processes } from "#test/postgres-example/processKit.ts";

processes.it(
	"private item and list hints cross hosts only after commit, stay silent on rollback and never reach another account",
	[privateSessionsAcrossHosts()],
	function* ({
		privateSave,
		privateRead,
		privateDeliveries,
		rejectNextPrivateCommit,
		settlePrivate,
		observePrivate,
		holdPrivateCommit,
		beginPrivateSave,
		privateCommitEntered,
		releasePrivateCommit,
		privateSaveResult,
	}) {
		const bob = privateDeliveries("bob");
		const writer = privateDeliveries("writer");
		const reader = privateDeliveries("reader");
		yield* holdPrivateCommit();
		yield* beginPrivateSave("Private title");
		yield* privateCommitEntered();
		yield* settlePrivate();
		expect(yield* privateRead("reader")).toBe("Printer paper");
		expect(privateDeliveries("reader")).toEqual(reader);
		expect(privateDeliveries("writer")).toEqual(writer);
		expect(privateDeliveries("bob")).toEqual(bob);
		yield* releasePrivateCommit();
		expect(yield* privateSaveResult()).toMatchObject({ _tag: "Success" });
		yield* observePrivate(() => {
			for (const name of ["writer", "reader"]) {
				expect(privateDeliveries(name).at(-1)).toMatchObject({ hint: { _tag: "Changed" }, list: ["Private title"], title: "Private title" });
			}
		});
		expect(privateDeliveries("bob")).toEqual(bob);
		expect(yield* privateRead("bob")).toBe("Unset");
		const before = privateDeliveries("reader");
		const writerBefore = privateDeliveries("writer");
		yield* rejectNextPrivateCommit();
		expect(yield* privateSave("Rolled back")).toMatchObject({ _tag: "Failure", failure: { _tag: "Rejected" } });
		yield* settlePrivate();
		expect(yield* privateRead("reader")).toBe("Private title");
		expect(privateDeliveries("reader")).toEqual(before);
		expect(privateDeliveries("writer")).toEqual(writerBefore);
		expect(privateDeliveries("bob")).toEqual(bob);
	},
);
