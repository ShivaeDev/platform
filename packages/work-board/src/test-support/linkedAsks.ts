import { boardStory } from "./boardStory.ts";
import { closedInboxFixture } from "./closedInboxFixture.ts";

export const linkedAsks = boardStory.trait("project", "closed, agent, duplicate and unresolved asks accompany linked work", (engine) => {
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
	for (const [file, contents] of Object.entries(files)) {
		engine.notes.write(file, contents);
	}
});
