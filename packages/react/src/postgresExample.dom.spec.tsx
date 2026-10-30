import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { integration } from "#test/postgres-example/integration.ts";
import { commitIsHeld, editorsAreOpen, liveRefreshBesideDirtyName, writerCommitHeld } from "#test/postgres-example/liveTraits.ts";

expectNoReactWarnings();

const saved = { name: "Office chairs", quantity: "450", server: "Office chairs / 450", status: "Saved" };

integration.it(
	"the writer's PostgreSQL commit reaches the reader's open editor over live HTTP",
	[writerCommitHeld()],
	function* ({ deliveries, editor, publications, releaseCommit, storedOrder }) {
		yield* outcomes({
			"publications before the commit": [publications(), []],
			"reader before the commit": [editor("reader"), { name: "Printer paper", quantity: "300", server: "Printer paper / 300", status: "Saved" }],
			"stored before the commit": [storedOrder(), ["Printer paper / 300"]],
		});

		yield* releaseCommit();

		yield* outcomes({
			deliveries: [deliveries(), ["Office chairs / 450", "Office chairs / 450"]],
			publications: [publications(), ["orders:1"]],
			reader: [editor("reader"), saved],
			stored: [storedOrder(), ["Office chairs / 450"]],
			writer: [editor("writer"), saved],
		});
	},
	20_000,
);

integration.it(
	"a live refresh keeps the reader's edited name and adopts the untouched quantity",
	[liveRefreshBesideDirtyName()],
	function* ({ editor }) {
		expect(yield* editor("reader")).toEqual({
			name: "Unsaved local name",
			quantity: "900",
			server: "Remote update / 900",
			status: "Unsaved changes",
		});
	},
	20_000,
);

integration.it(
	"reverting after a live refresh restores the received order",
	[liveRefreshBesideDirtyName()],
	function* ({ editor, revertOrder }) {
		yield* revertOrder("reader");

		expect(yield* editor("reader")).toEqual({ name: "Remote update", quantity: "900", server: "Remote update / 900", status: "Saved" });
	},
	20_000,
);

for (const [caller, token, answer] of [
	["an anonymous caller", undefined, "rejected as Unauthorized"],
	["Bob, who does not own the order", "bob-session", "rejected as Missing"],
] as const) {
	integration.it(
		`${caller} cannot overwrite Alice's order`,
		[editorsAreOpen("reader")],
		function* ({ answers, forbiddenSave, publications, storedOrder }) {
			yield* forbiddenSave(token);

			yield* outcomes({
				answer: [answers(), [answer]],
				publications: [publications(), []],
				stored: [storedOrder(), ["Printer paper / 300"]],
			});
		},
		20_000,
	);
}

integration.it(
	"a save rolled back inside its PostgreSQL transaction publishes no live hint",
	[commitIsHeld(true), editorsAreOpen("reader")],
	function* ({ answers, deliveries, editor, publications, readsSinceAction, rejectedSave, storedOrder }) {
		yield* rejectedSave();

		yield* outcomes({
			answers: [answers(), ["rejected as Rejected", "saved"]],
			deliveries: [deliveries(), ["After rollback / 300"]],
			publications: [publications(), ["orders:1"]],
			reader: [editor("reader"), { name: "After rollback", quantity: "300", server: "After rollback / 300", status: "Saved" }],
			"reader reads": [readsSinceAction(), [1]],
			stored: [storedOrder(), ["After rollback / 300"]],
		});
	},
	20_000,
);
