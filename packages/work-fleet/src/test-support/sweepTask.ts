export function sweepTask(id: string, sweep?: readonly string[]) {
	return [
		"---",
		`id: ${id}`,
		"kind: task",
		"owner: codex",
		"status: ready",
		"fleet: approved",
		...(sweep === undefined ? [] : [`sweep: ${JSON.stringify(sweep)}`]),
		"---",
		`# ${id}`,
		"Migrate the shared catalog and retain each package's intended dependencies.",
	].join("\n");
}
