import { questionSource } from "./settledFixture.ts";

export const settledReferencesFixture = {
	"decisions/settled.md": questionSource("decision.settled", "done"),
	"index.md": "---\nid: board.index\nitems: [decision.settled, task.live]\n---\n# Work\n",
	"task.md": "---\nid: task.live\nkind: task\nrelationships: [{kind: depends_on, target: decision.settled}]\n---\n# Live work\n",
};
