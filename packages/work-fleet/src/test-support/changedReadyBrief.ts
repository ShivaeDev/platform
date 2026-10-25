export function changedReadyBrief(source: string, change: string) {
	if (change === "unapproved") {
		return source.replace("fleet: approved", "fleet: held");
	}
	if (change === "owner") {
		return source.replace("owner: codex", "owner: marvin");
	}
	return source.replace("kind: task", `kind: task\nstatus: ${change}`);
}
