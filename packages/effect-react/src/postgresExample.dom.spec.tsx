import { expect } from "vitest";
import { expectNoReactWarnings } from "#client/testing.ts";
import { integration } from "#test/postgres-example/integration.ts";
import { commitIsHeld, editorsAreOpen } from "#test/postgres-example/liveTraits.ts";

expectNoReactWarnings();

integration.it(
	"an authenticated PostgreSQL commit reaches another client's query and open editor over live HTTP",
	[commitIsHeld(), editorsAreOpen("writer", "reader")],
	function* ({
		editName,
		editQuantity,
		submitOrder,
		commitHasEntered,
		storedOrder,
		publications,
		deliveriesSinceBaseline,
		editor,
		observe,
		recordBaseline,
		reads,
		releaseCommit,
		revertOrder,
		forbiddenSave,
	}) {
		yield* observe("both editors load the order and subscribe", () => {
			expect(reads()).toEqual([1, 1, 1, 1]);
			for (const name of ["writer", "reader"]) {
				expect(editor(name)).toEqual({
					connection: "live",
					name: "Printer paper",
					quantity: "300",
					serverOrder: "Printer paper / 300",
					status: "Saved",
					waiting: false,
				});
			}
		});
		yield* recordBaseline();
		yield* editName("writer", "  Office chairs  ");
		yield* editQuantity("writer", "450");
		yield* submitOrder("writer");
		yield* commitHasEntered();
		expect(yield* storedOrder()).toEqual([{ name: "Printer paper", quantity: 300 }]);
		expect(publications()).toEqual([]);
		expect(deliveriesSinceBaseline()).toEqual([]);
		expect(editor("reader")).toMatchObject({
			name: "Printer paper",
			quantity: "300",
			serverOrder: "Printer paper / 300",
			status: "Saved",
			waiting: false,
		});
		yield* releaseCommit();
		yield* observe("the committed order reaches both editors", () => {
			for (const name of ["reader", "writer"]) {
				expect(editor(name)).toMatchObject({
					name: "Office chairs",
					quantity: "450",
					serverOrder: "Office chairs / 450",
					status: "Saved",
					waiting: false,
				});
			}
		});
		expect(yield* storedOrder()).toEqual([{ name: "Office chairs", quantity: 450 }]);
		expect(publications()).toEqual(["orders:1"]);
		expect(deliveriesSinceBaseline()).toEqual([[{ name: "Office chairs", quantity: 450 }], [{ name: "Office chairs", quantity: 450 }]]);
		yield* editName("reader", "Unsaved local name");
		yield* editName("writer", "Remote update");
		yield* editQuantity("writer", "900");
		yield* submitOrder("writer");
		yield* observe("a live refresh preserves the reader's dirty name", () => {
			expect(editor("reader")).toMatchObject({
				name: "Unsaved local name",
				quantity: "900",
				serverOrder: "Remote update / 900",
				status: "Unsaved changes",
				waiting: false,
			});
			expect(editor("writer")).toMatchObject({
				name: "Remote update",
				quantity: "900",
				serverOrder: "Remote update / 900",
				status: "Saved",
				waiting: false,
			});
		});
		yield* revertOrder("reader");
		expect(editor("reader").name).toBe("Remote update");
		expect(yield* forbiddenSave()).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
		expect(yield* forbiddenSave("bob-session")).toMatchObject({ _tag: "Failure", failure: { _tag: "Missing" } });
		expect(publications()).toEqual(["orders:1", "orders:1"]);
		expect(yield* storedOrder()).toEqual([{ name: "Remote update", quantity: 900 }]);
	},
	20_000,
);

integration.it(
	"a write recorded inside a rolled-back PostgreSQL transaction publishes no live hint",
	[commitIsHeld(true), editorsAreOpen("reader")],
	function* ({
		beginRejectedSave,
		commitHasEntered,
		storedOrder,
		publications,
		deliveriesSinceBaseline,
		releaseCommit,
		saveResult,
		readsSinceBaseline,
		editor,
		observe,
		recordBaseline,
		reads,
	}) {
		yield* observe("the reader loads the order and subscribes", () => {
			expect(reads()).toEqual([1, 1]);
			expect(editor("reader")).toEqual({
				connection: "live",
				name: "Printer paper",
				quantity: "300",
				serverOrder: "Printer paper / 300",
				status: "Saved",
				waiting: false,
			});
		});
		yield* recordBaseline();
		yield* beginRejectedSave();
		yield* commitHasEntered();
		expect(yield* storedOrder()).toEqual([{ name: "Printer paper", quantity: 300 }]);
		expect(publications()).toEqual([]);
		expect(deliveriesSinceBaseline()).toEqual([]);
		yield* releaseCommit();
		expect(yield* saveResult()).toMatchObject({ _tag: "Failure", failure: { _tag: "Rejected" } });
		expect(readsSinceBaseline()).toEqual([]);
		expect(yield* storedOrder()).toEqual([{ name: "Printer paper", quantity: 300 }]);
		expect(publications()).toEqual([]);
		expect(deliveriesSinceBaseline()).toEqual([]);
		expect(editor("reader")).toMatchObject({
			name: "Printer paper",
			quantity: "300",
			serverOrder: "Printer paper / 300",
			status: "Saved",
			waiting: false,
		});
	},
	20_000,
);
