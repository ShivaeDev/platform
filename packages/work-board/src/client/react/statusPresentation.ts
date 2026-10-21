import { Check, Circle, CircleHelp, CircleMinus, CirclePause, CircleX, LoaderCircle, MessageCircle, Users } from "lucide-react";
import { statusLabel } from "#browser/views/statusLabel.ts";

const statuses = {
	answered: { icon: Check, token: "done" },
	deferred: { icon: CirclePause, token: "deferred" },
	done: { icon: Check, token: "done" },
	draft: { icon: Circle, token: "deferred" },
	dropped: { icon: CircleX, token: "deferred" },
	"needs-you": { icon: MessageCircle, token: "needs-you" },
	queued: { icon: Circle, token: "deferred" },
	ready: { icon: Circle, token: "agent-working" },
	released: { icon: CircleMinus, token: "deferred" },
	reviewing: { icon: LoaderCircle, token: "agent-working" },
	waiting: { icon: Users, token: "waiting-on-agents" },
	"waiting-on-agents": { icon: Users, token: "waiting-on-agents" },
	working: { icon: LoaderCircle, token: "agent-working" },
} as const;

function known(status: string): status is keyof typeof statuses {
	return Object.hasOwn(statuses, status);
}
export function statusPresentation(status: string | undefined) {
	const label = statusLabel(status ?? "");
	return status && known(status) ? { ...statuses[status], label } : ({ icon: CircleHelp, label, token: "deferred" } as const);
}
