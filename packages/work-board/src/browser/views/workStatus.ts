export const workPhases = ["planned", "queued", "executing", "reviewing", "delivering", "waiting", "needs-you", "closed", "deferred"] as const;
export type WorkPhase = (typeof workPhases)[number];

const vocabulary: Readonly<Record<string, WorkPhase>> = {
	active: "executing",
	adopting: "executing",
	"agent-working": "executing",
	approved: "queued",
	blocked: "waiting",
	canceled: "closed",
	cancelled: "closed",
	closed: "closed",
	completed: "closed",
	deferred: "deferred",
	delivering: "delivering",
	done: "closed",
	dropped: "closed",
	executing: "executing",
	"in progress": "executing",
	"in review": "reviewing",
	"in-progress": "executing",
	"in-review": "reviewing",
	"needs-human": "needs-you",
	"needs-you": "needs-you",
	planned: "planned",
	prepared: "queued",
	ready: "planned",
	received: "planned",
	released: "closed",
	repairing: "reviewing",
	resolved: "closed",
	review: "reviewing",
	reviewing: "reviewing",
	running: "executing",
	superseded: "closed",
	validating: "reviewing",
	"waiting-on-person": "waiting",
};
const held: ReadonlySet<WorkPhase> = new Set(["executing", "reviewing", "delivering"]);

function normalized(status: string | undefined): string {
	return status?.trim().toLowerCase() ?? "";
}

// A file without a status is planned work; undefined means the vocabulary does not know the status.
export function workPhase(status: string | undefined): WorkPhase | undefined {
	const key = normalized(status);
	if (key === "") {
		return "planned";
	}
	return Object.hasOwn(vocabulary, key) ? vocabulary[key] : undefined;
}

export function heldPhase(phase: WorkPhase | undefined): boolean {
	return phase !== undefined && held.has(phase);
}

export function closedStatus(status: string | undefined): boolean {
	return workPhase(status) === "closed";
}

export function deferredStatus(status: string | undefined): boolean {
	return workPhase(status) === "deferred";
}
