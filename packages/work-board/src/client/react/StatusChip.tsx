import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { statusPresentation } from "./statusPresentation.ts";

// The stock badge's 10px text is too small to read on a phone, and amber is the Board's one "needs you" signal, so only that state is solid.
// The quiet tint is mixed over the card rather than left translucent, so a hovered or selected row behind it can't pull the label under 4.5:1.
const QUIET_TINT =
	"border-(--tone)/25 bg-[color-mix(in_oklab,var(--tone)_10%,var(--color-card))] text-(--tone) dark:bg-[color-mix(in_oklab,var(--tone)_10%,var(--color-card))]";
const colors = cva("text-xs [&>svg]:size-3!", {
	variants: {
		status: {
			"agent-working": `${QUIET_TINT} [--tone:var(--color-agent-working)]`,
			blocked: `${QUIET_TINT} [--tone:var(--color-blocked)]`,
			deferred: `${QUIET_TINT} [--tone:var(--color-deferred)]`,
			done: `${QUIET_TINT} [--tone:var(--color-done)]`,
			"needs-you": "",
			"waiting-on-agents": `${QUIET_TINT} [--tone:var(--color-waiting-on-agents)]`,
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
		<Badge
			className={cn(colors({ status: value.token }), className)}
			data-status-token={value.token}
			variant={value.token === "needs-you" ? "default" : "outline"}
			{...props}
		>
			<Icon aria-hidden="true" />
			{value.label}
		</Badge>
	);
}
