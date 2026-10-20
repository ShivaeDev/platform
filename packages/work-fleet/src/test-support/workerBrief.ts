import { join } from "node:path";
import { FileSystem } from "effect";
import { host } from "#test/hostStory.ts";

export const REPOSITORY_PURPOSE = "This repository provides project planning tools that keep a team's goals, plans and daily work connected.";
export const repositoryReadme = host.trait("observation", "the repository README explains the product", function* (engine) {
	if (engine.repositoryRoot === undefined) {
		throw new Error("Use the local Board repository fixture before writing its README");
	}
	const fs = yield* FileSystem.FileSystem;
	yield* fs.writeFileString(
		join(engine.repositoryRoot, "README.md"),
		`# Planning tools\n\n${REPOSITORY_PURPOSE}\n\n## Setup\n\nPrivate setup details.\n`,
	);
});

export const goal = `---
id: goal.navigation
kind: goal
status: active
relationships:
  - kind: implements
    target: goal.planning
---
# People can navigate a growing project

People need to find the work that advances their project without memorizing document names. The sidebar should explain the structure of the work: a goal contains its plans, and a plan contains the tasks that make it happen. A person who arrives in an unfamiliar project should be able to follow that structure from the desired outcome to the next piece of work. This matters most once a project has enough documents that a flat alphabetical list stops being useful.

Navigation must preserve the current selection while documents change. Opening a group exposes its children, and choosing a child shows that document without losing the surrounding hierarchy. A document that has no parent remains reachable at the root, so people can continue to organize their project gradually. The result should work with the existing document links and keep navigation separate from editing the underlying relationships.
`;

export const planningGoal = `---
id: goal.planning
kind: goal
---
# Daily work serves a clear outcome

Project planning connects a team's purpose to the work people do every day. Someone reviewing a task should understand the outcome it serves before deciding how to implement it. Someone planning the next week should see which tasks advance the same goal and which still need a plan. The product should make those connections visible in the normal flow of reading and doing work, rather than requiring a second planning document to explain them.
`;

export const navigationTask = `---
id: task.navigation
kind: task
status: ready
owner: codex
fleet: approved
fleet-priority: high
next_action: Build the hierarchy.
areas: [navigation, documents]
criteria:
  - id: hierarchy
    text: The sidebar groups tasks under their plans and plans under their goals, with each document reachable through its existing link.
  - id: selection
    text: Selecting a nested document opens it and retains the surrounding hierarchy, so people can move between related tasks without reconstructing their place.
  - id: orphans
    text: Documents without a parent remain available at the root, and empty groups remain visible so the project can be organized gradually.
relationships:
  - kind: implements
    target: goal.navigation
---
# Sidebar follows the project hierarchy

Replace the flat document list with expandable groups based on the relationships already stored with each document. A user should be able to trace a goal through its plans to the work that advances it, while continuing to use direct links and the selected document pane. Use the existing sidebar components and keep the change within navigation and document presentation. Relationship editing remains in the document editor.
`;

export const cloudWorker = {
	cloud: { cwd: "/workspace/repository", environmentId: "synthetic-environment" },
	provider: "cloud",
	worker: { branchPrefix: "worker/", sharedEnvironment: "/workspace/env.sh" },
} as const;
