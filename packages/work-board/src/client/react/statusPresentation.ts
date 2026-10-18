import { Ban, Check, Circle, CircleHelp, CirclePause, Clock, Inbox, LoaderCircle, MessageCircle, Users } from "lucide-react";

const statuses = {
	active: { icon: LoaderCircle, token: "agent-working" },
	adopting: { icon: LoaderCircle, token: "agent-working" },
	"agent-working": { icon: LoaderCircle, token: "agent-working" },
	blocked: { icon: Ban, token: "blocked" },
	completed: { icon: Check, token: "done" },
	deferred: { icon: CirclePause, token: "deferred" },
	delivering: { icon: LoaderCircle, token: "agent-working" },
	done: { icon: Check, token: "done" },
	executing: { icon: LoaderCircle, token: "agent-working" },
	"in progress": { icon: LoaderCircle, token: "agent-working" },
	"in-progress": { icon: LoaderCircle, token: "agent-working" },
	"needs-human": { icon: MessageCircle, token: "needs-you" },
	"needs-you": { icon: MessageCircle, token: "needs-you" },
	planned: { icon: Circle, token: "deferred" },
	prepared: { icon: Circle, token: "deferred" },
	received: { icon: Inbox, token: "deferred" },
	repairing: { icon: LoaderCircle, token: "agent-working" },
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
	return status && known(status) ? statuses[status] : ({ icon: CircleHelp, token: "deferred" } as const);
}
