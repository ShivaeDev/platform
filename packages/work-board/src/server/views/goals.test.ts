import { expect, it } from "vitest";
import { inboxCount } from "#server/navigation/model.ts";
import { closedInboxFixture } from "#test/closedInboxFixture.ts";
import { inboxSnapshot } from "#test/inboxFixture.ts";
import { goals } from "./goals.ts";

it("counts only eligible active Inbox rows for linked work, never more than the Inbox", () => {
	const files = closedInboxFixture();
	files["goal.md"] = "---\nid: project.example\nkind: project\nstatus: planned\n---\n# Goal";
	for (const status of ["done", "planned", "superseded", "deferred"]) {
		files[`${status}.md`] =
			files[`${status}.md`]?.replace("owner: codex", "owner: codex\nrelationships:\n - kind: implements\n   target: project.example") ?? "";
	}
	const source = files["asks/planned-2.md"] ?? "";
	files["asks/agent.md"] = source.replace("decision.planned.2", "decision.agent").replace("[maintainer]", "[agent]");
	files["asks/invalid.md"] = source.replace("decision.planned.2", "decision.invalid").replace("[task.planned]", "[missing]");
	files["asks/duplicate.md"] = source.replace("decision.planned.2", "decision.invalid");
	const snapshot = inboxSnapshot(files);
	const goal = goals(snapshot).goals[0];
	expect(goal?.openAsks).toBe(1);
	expect(inboxCount(snapshot)).toBe(2);
	expect(goal?.openAsks).toBeLessThanOrEqual(inboxCount(snapshot) ?? 0);
	expect(goals({ ...snapshot, unavailable: ["missing.md"] }).goals[0]?.openAsks).toBe(0);
});
