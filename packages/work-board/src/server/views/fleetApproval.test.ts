import { Effect } from "effect";
import { RpcTest } from "effect/rpc";
import { expect, it } from "vitest";
import { laneOf } from "#browser/views/now.ts";
import { workRpcs } from "#rpc/contract.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { inMemoryBoard } from "#test/inMemoryBoard.ts";
import { fleetApproval } from "./fleetApproval.ts";

it.each(["approved", '"approved"', "pending", "[approved]", "{value: approved}"])("projects the exact Fleet approval value %s", async (approval) => {
	const source = `---\nid: task\nkind: task\nstatus: planned\nfleet: ${approval}\n---\n# Task`;
	const projection = await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const client = yield* RpcTest.makeClient(workRpcs, { flatten: true });
				return yield* client("work-board.work", { url: "/_board/work" });
			}),
		).pipe(Effect.provide(inMemoryBoard({ "task.md": source }))),
	);
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
