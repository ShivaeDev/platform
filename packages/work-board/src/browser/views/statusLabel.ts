const labels: Readonly<Record<string, string>> = {
	active: "Active",
	adopting: "Adopting",
	"agent-working": "Agent working",
	blocked: "Blocked",
	completed: "Completed",
	deferred: "Deferred",
	delivering: "Delivering",
	done: "Done",
	executing: "Executing",
	"in progress": "In progress",
	"in-progress": "In progress",
	"needs-human": "Needs you",
	"needs-you": "Needs you",
	planned: "Planned",
	prepared: "Prepared",
	received: "Received",
	repairing: "Repairing",
	reviewing: "Reviewing",
	running: "Running",
	superseded: "Superseded",
	validating: "Validating",
	"waiting-on-agents": "Waiting on agents",
};

export function statusLabel(status: string): string {
	if (Object.hasOwn(labels, status)) {
		return labels[status] ?? status;
	}
	return sentenceLabel(status);
}

export function sentenceLabel(value: string): string {
	const words = value.replaceAll(/[-_\s]+/gu, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function kindLabel(kind: string): string {
	return sentenceLabel(kind === "project" ? "goal" : kind);
}

export function sameStatus(left: string, right: string): boolean {
	return statusLabel(left) === statusLabel(right);
}

export function statusOptions(statuses: Iterable<string>): readonly string[] {
	const options = new Map<string, string>();
	for (const status of [...statuses].filter(Boolean).toSorted((left, right) => left.localeCompare(right, "en"))) {
		if (!options.has(statusLabel(status))) {
			options.set(statusLabel(status), status);
		}
	}
	return [...options].sort(([left], [right]) => left.localeCompare(right, "en")).map(([, status]) => status);
}
