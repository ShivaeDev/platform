export function goalsFixture(): Readonly<Record<string, string>> {
	return {
		"asks.md":
			"---\nid: decision.review\nkind: question\nscope: task\nurgency: whenever\nattention:\n - id: goal\n   kind: review\n   state: open\n   response_from: [maintainer]\n   reason: Review goal\n   unblocks: [project.example, task.first]\n - id: criterion\n   kind: blocker\n   state: open\n   response_from: [agent]\n   reason: Review criterion\n   unblocks: [project.example#second]\n - id: task\n   kind: decision\n   state: open\n   response_from: [maintainer]\n   reason: Review task\n   unblocks: [task.fifth]\n - id: closed\n   kind: review\n   state: closed\n   response_from: [maintainer]\n   reason: Already answered\n   unblocks: [project.example]\n - id: unrelated\n   kind: review\n   state: open\n   response_from: [maintainer]\n   reason: Another goal\n   unblocks: [project.closed]\n---\n# Asks",
		"claims.md":
			"---\nevidence:\n - source: report\n   criterion: project.example#second\n - source: unrelated\n   criterion: project.empty#untouched\nrelationships:\n - kind: informs\n   target: project.example\n---\n# Claims",
		"closed.md": "---\nid: project.closed\nkind: goal\nstatus: done\n---\n# Closed goal",
		"empty.md": "---\nid: project.empty\nkind: goal\nstatus: deferred\ncriteria:\n - id: untouched\n   text: No linked work\n---\n# Empty goal",
		"fifth.md": "---\nid: task.fifth\nkind: task\nrelationships:\n - kind: implements\n   target: project.example\n---\n# Fifth task",
		"first.md":
			"---\nid: task.first\nkind: task\nstatus: done\nrelationships:\n - kind: implements\n   target: project.example#first\n - kind: implements\n   target: project.example\nevidence:\n - source: test output\n   criterion: project.example#first\n - source: another claim\n   criterion: project.example#first\n---\n# First task",
		"fourth.md":
			"---\nid: task.fourth\nkind: task\nstatus: done\nrelationships:\n - kind: implements\n   target: project.example\n---\n# Fourth task",
		"goal.md":
			"---\nid: project.example\nkind: goal\nstatus: draft\nowner: claude\nnext_action: Review linked work\ncriteria:\n - id: first\n   text: First criterion\n - id: second\n   text: Second criterion\n---\n# Example goal",
		"second.md":
			"---\nid: task.second\nkind: task\nstatus: draft\nrelationships:\n - kind: implements\n   target: project.example#first\n---\n# Second task",
		"third.md":
			"---\nid: task.third\nkind: task\nstatus: deferred\nrelationships:\n - kind: implements\n   target: project.example#second\n---\n# Third task",
	};
}
