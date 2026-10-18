import { Ban, Check, Circle, CircleHelp, CirclePause, Clock, Inbox, LoaderCircle, MessageCircle, Users } from "lucide-react";

const statuses = {
	active: { icon: LoaderCircle, label: "Active", token: "agent-working" },
	adopting: { icon: LoaderCircle, label: "Adopting", token: "agent-working" },
	"agent-working": { icon: LoaderCircle, label: "Agent working", token: "agent-working" },
	blocked: { icon: Ban, label: "Blocked", token: "blocked" },
	completed: { icon: Check, label: "Completed", token: "done" },
	deferred: { icon: CirclePause, label: "Deferred", token: "deferred" },
	delivering: { icon: LoaderCircle, label: "Delivering", token: "agent-working" },
	done: { icon: Check, label: "Done", token: "done" },
	executing: { icon: LoaderCircle, label: "Executing", token: "agent-working" },
	"in progress": { icon: LoaderCircle, label: "In progress", token: "agent-working" },
	"in-progress": { icon: LoaderCircle, label: "In progress", token: "agent-working" },
	"needs-human": { icon: MessageCircle, label: "Needs you", token: "needs-you" },
	"needs-you": { icon: MessageCircle, label: "Needs you", token: "needs-you" },
	planned: { icon: Circle, label: "Planned", token: "deferred" },
	prepared: { icon: Circle, label: "Prepared", token: "deferred" },
	received: { icon: Inbox, label: "Received", token: "deferred" },
	repairing: { icon: LoaderCircle, label: "Repairing", token: "agent-working" },
	reviewing: { icon: LoaderCircle, label: "Reviewing", token: "agent-working" },
	running: { icon: LoaderCircle, label: "Running", token: "agent-working" },
	superseded: { icon: Clock, label: "Superseded", token: "deferred" },
	validating: { icon: LoaderCircle, label: "Validating", token: "agent-working" },
	"waiting-on-agents": { icon: Users, label: "Waiting on agents", token: "waiting-on-agents" },
} as const;
function known(status: string): status is keyof typeof statuses {
	return Object.hasOwn(statuses, status);
}
export function statusPresentation(status: string | undefined) {
	if (status && known(status)) {
		return statuses[status];
	}
	return { icon: CircleHelp, label: plainStatus(status ?? ""), token: "deferred" } as const;
}
function plainStatus(status: string) {
	const words = status.replaceAll(/[-_\s]+/gu, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}
