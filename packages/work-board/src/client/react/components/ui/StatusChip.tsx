import { cva } from "class-variance-authority";
import { Ban, Check, CircleHelp, CirclePause, Clock, LoaderCircle, MessageCircle, Users } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "#client/react/lib/cn.ts";
import { Badge } from "./Badge.tsx";

const statuses = {
	"agent-working": { icon: LoaderCircle, token: "agent-working" },
	blocked: { icon: Ban, token: "blocked" },
	deferred: { icon: CirclePause, token: "deferred" },
	done: { icon: Check, token: "done" },
	"in-progress": { icon: LoaderCircle, token: "agent-working" },
	"needs-human": { icon: MessageCircle, token: "needs-you" },
	"needs-you": { icon: MessageCircle, token: "needs-you" },
	running: { icon: LoaderCircle, token: "agent-working" },
	superseded: { icon: Clock, token: "deferred" },
	"waiting-on-agents": { icon: Users, token: "waiting-on-agents" },
} as const;
const colors = cva("", {
	variants: {
		status: {
			"agent-working": "border-agent-working/25 bg-agent-working/10 text-agent-working",
			blocked: "border-blocked/25 bg-blocked/10 text-blocked",
			deferred: "border-deferred/25 bg-deferred/10 text-deferred",
			done: "border-done/25 bg-done/10 text-done",
			"needs-you": "border-needs-you/25 bg-needs-you/10 text-needs-you",
			"waiting-on-agents": "border-waiting-on-agents/25 bg-waiting-on-agents/10 text-waiting-on-agents",
		},
	},
});
function known(status: string): status is keyof typeof statuses {
	return Object.hasOwn(statuses, status);
}
export function StatusChip({ status, className, ...props }: ComponentProps<"span"> & { readonly status: string | undefined }) {
	const value = status && known(status) ? statuses[status] : ({ icon: CircleHelp, token: "deferred" } as const);
	const Icon = value.icon;
	return (
		<Badge className={cn(colors({ status: value.token }), className)} data-status-token={value.token} variant="outline" {...props}>
			<Icon aria-hidden="true" />
			{status || "Not recorded"}
		</Badge>
	);
}
