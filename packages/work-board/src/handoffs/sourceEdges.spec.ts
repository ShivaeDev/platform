import { chmodSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { silentWatch } from "#test/faults.ts";
import { responseWorkspace } from "#test/responseEdges.ts";

let workspace: Awaited<ReturnType<typeof responseWorkspace>>;
afterEach(async () => workspace?.stop());

it("rejects a registered question as a handoff project item with the exact source correction", async () => {
	workspace = await responseWorkspace();
	const question = await workspace.register();
	await expect(workspace.client.run(workspace.client.handoffs.handoffSource.run({ item: question.id }))).rejects.toMatchObject({
		code: "Stale",
		message: "Choose a current project item for this handoff.",
	});
});

it("reports an indexed handoff source losing read permission before the live watcher catches up", async () => {
	workspace = await responseWorkspace(undefined, silentWatch);
	function read() {
		return workspace.client.run(workspace.client.handoffs.handoffSource.run({ item: "investigation.choices" }));
	}
	await read();
	chmodSync(join(workspace.notes.root, "proposal.md"), 0o000);
	try {
		await expect(read()).rejects.toMatchObject({ code: "Unavailable", message: "The handoff source could not be read." });
	} finally {
		chmodSync(join(workspace.notes.root, "proposal.md"), 0o644);
	}
});
