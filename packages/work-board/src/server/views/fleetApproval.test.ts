import { Effect } from "effect";
import { expect, it } from "vitest";
import { laneOf } from "#browser/views/now.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { fixtureSnapshot } from "#test/fixtureSnapshot.ts";
import { fleetApproval } from "./fleetApproval.ts";
import { projectionQueries } from "./projectionQueries.ts";

it.each(["approved", '"approved"', "pending", "[approved]", "{value: approved}"])("projects the exact Fleet approval value %s", async (approval) => {
	const source = `---\nid: task\nkind: task\nstatus: planned\nfleet: ${approval}\n---\n# Task`;
	const snapshot = await Effect.runPromise(fixtureSnapshot({ "task.md": source }, undefined));
	const projection = await Effect.runPromise(projectionQueries({ document: undefined, index: Effect.succeed(snapshot) }).work("/_board/work"));
	const item = projection.rows[0];
	if (!item) {
		throw new Error("Missing projected task");
	}
	const approved = approval === "approved" || approval === '"approved"';
	expect(item.fleetApproved).toBe(approved);
	expect(laneOf(item.metadata, undefined, item.fleetApproved)).toBe(approved ? "Queued" : undefined);
});

it.each(["# No header", "---\nfleet: approved\nfleet: pending\n---\n# Duplicate", "---\nfleet: [\n---\n# Invalid"])(
	"does not invent approval for malformed or missing frontmatter",
	(source) => {
		expect(fleetApproval(metadataParse(source))).toBe(false);
	},
);
