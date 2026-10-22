export const states: Readonly<Record<string, string>> = {
	active: "ready",
	adopting: "ready",
	"agent-working": "ready",
	approved: "ready",
	blocked: "ready",
	canceled: "dropped",
	cancelled: "dropped",
	closed: "done",
	completed: "done",
	delivering: "ready",
	executing: "ready",
	"in progress": "ready",
	"in review": "ready",
	"in-progress": "ready",
	"in-review": "ready",
	"needs-human": "ready",
	"needs-you": "ready",
	open: "ready",
	planned: "draft",
	prepared: "ready",
	proposed: "draft",
	received: "done",
	recorded: "done",
	released: "done",
	repairing: "ready",
	resolved: "done",
	review: "ready",
	reviewing: "ready",
	running: "ready",
	superseded: "dropped",
	validating: "ready",
	"waiting-on-person": "ready",
};
export const kinds: Readonly<Record<string, string>> = { decision: "question", investigation: "task", project: "goal", result: "report" };

export function oldOwner(owner: string): string | undefined {
	const normalized = owner.toLowerCase();
	if (normalized === "cloud-worker" || normalized === "codex") {
		return "codex";
	}
	if (normalized === "marvin") {
		return "marvin";
	}
	if (normalized === "claude" || normalized === "orchestrator" || normalized.startsWith("claude-")) {
		return "claude";
	}
	return undefined;
}
