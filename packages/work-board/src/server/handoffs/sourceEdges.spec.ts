import { chmodSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { silentWatch } from "#test/faults.ts";
import { responseWorkspace } from "#test/responseEdges.ts";

let workspace: Effect.Success<ReturnType<typeof responseWorkspace>>;

it.live("rejects a registered question as a handoff project item with the exact source correction", function* () {
	workspace = yield* responseWorkspace();
	const question = yield* Effect.promise(() => workspace.register());
	yield* Effect.promise(() =>
		expect(workspace.client.run(workspace.client.handoffs.handoffSource.run({ item: question.id }))).rejects.toMatchObject({
			_tag: "PreconditionFailed",
			message: "Choose a current project item for this handoff.",
		}),
	);
});

it.live("reports an indexed handoff source losing read permission before the live watcher catches up", function* () {
	workspace = yield* responseWorkspace(undefined, silentWatch);
	function read() {
		return workspace.client.run(workspace.client.handoffs.handoffSource.run({ item: "investigation.choices" }));
	}
	yield* Effect.promise(() => read());
	chmodSync(join(workspace.notes.root, "proposal.md"), 0o000);
	try {
		yield* Effect.promise(() =>
			expect(read()).rejects.toMatchObject({ _tag: "ServiceUnavailable", message: "The handoff source could not be read." }),
		);
	} finally {
		chmodSync(join(workspace.notes.root, "proposal.md"), 0o644);
	}
});
