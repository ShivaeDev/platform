import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { statusPresentation } from "./statusPresentation.ts";

const colors = cva("", {
	variants: {
		status: {
			"agent-working": "border-agent-working/25 bg-agent-working/10 text-agent-working dark:bg-agent-working/10",
			blocked: "border-blocked/25 bg-blocked/10 text-blocked dark:bg-blocked/10",
			deferred: "border-deferred/25 bg-deferred/10 text-deferred dark:bg-deferred/10",
			done: "border-done/25 bg-done/10 text-done dark:bg-done/10",
			"needs-you": "border-needs-you/25 bg-needs-you/10 text-needs-you dark:bg-needs-you/10",
			"waiting-on-agents": "border-waiting-on-agents/25 bg-waiting-on-agents/10 text-waiting-on-agents dark:bg-waiting-on-agents/10",
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
