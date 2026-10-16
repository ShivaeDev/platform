import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "#client/react/lib/cn.ts";
import { Badge } from "./Badge.tsx";
import { statusPresentation } from "./statusPresentation.ts";

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
export function StatusChip({ status, className, ...props }: ComponentProps<"span"> & { readonly status: string | undefined }) {
	if (!status) {
		return null;
	}
	const value = statusPresentation(status);
	const Icon = value.icon;
	return (
		<Badge className={cn(colors({ status: value.token }), className)} data-status-token={value.token} variant="outline" {...props}>
			<Icon aria-hidden="true" />
			{status}
		</Badge>
	);
}
