import { task } from "#test/fleetHost.ts";

export function criterionSource(text: string) {
	return task("one", "approved", "Use repository fixtures.").replace(
		"kind: task",
		`kind: task\ncriteria:\n  - id: build\n    text: Build passes.\n  - id: evidence\n    text: ${text}`,
	);
}
