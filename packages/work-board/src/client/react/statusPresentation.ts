import { Ban, Check, Circle, CircleHelp, CircleMinus, CirclePause, CircleX, Clock, Inbox, LoaderCircle, MessageCircle, Users } from "lucide-react";
import { statusLabel } from "#browser/views/statusLabel.ts";

const statuses = {
	active: { icon: LoaderCircle, token: "agent-working" },
	adopting: { icon: LoaderCircle, token: "agent-working" },
	"agent-working": { icon: LoaderCircle, token: "agent-working" },
	answered: { icon: Check, token: "done" },
	blocked: { icon: Ban, token: "blocked" },
	closed: { icon: CircleMinus, token: "deferred" },
	completed: { icon: Check, token: "done" },
	deferred: { icon: CirclePause, token: "deferred" },
	delivering: { icon: LoaderCircle, token: "agent-working" },
	done: { icon: Check, token: "done" },
	dropped: { icon: CircleX, token: "deferred" },
	executing: { icon: LoaderCircle, token: "agent-working" },
	finished: { icon: Check, token: "done" },
	"in progress": { icon: LoaderCircle, token: "agent-working" },
	"in-progress": { icon: LoaderCircle, token: "agent-working" },
	"in-review": { icon: LoaderCircle, token: "agent-working" },
	"needs you": { icon: MessageCircle, token: "needs-you" },
	"needs-human": { icon: MessageCircle, token: "needs-you" },
	"needs-you": { icon: MessageCircle, token: "needs-you" },
	planned: { icon: Circle, token: "deferred" },
	prepared: { icon: Circle, token: "deferred" },
	ready: { icon: Circle, token: "deferred" },
	received: { icon: Inbox, token: "deferred" },
	repairing: { icon: LoaderCircle, token: "agent-working" },
	review: { icon: LoaderCircle, token: "agent-working" },
	reviewing: { icon: LoaderCircle, token: "agent-working" },
	running: { icon: LoaderCircle, token: "agent-working" },
	superseded: { icon: Clock, token: "deferred" },
	validating: { icon: LoaderCircle, token: "agent-working" },
	"waiting-on-agents": { icon: Users, token: "waiting-on-agents" },
} as const;
function known(status: string): status is keyof typeof statuses {
	return Object.hasOwn(statuses, status);
}
export function statusPresentation(status: string | undefined) {
	const label = statusLabel(status ?? "");
	return status && known(status) ? { ...statuses[status], label } : ({ icon: CircleHelp, label, token: "deferred" } as const);
}
