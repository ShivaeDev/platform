import { type LucideIcon, Pause, RefreshCwOff, WifiOff } from "lucide-react";
import type { liveStatus } from "./liveStatus.ts";
import { shellIds } from "./shellIds.ts";

type LiveState = ReturnType<typeof liveStatus>["state"];

const problems: Partial<Record<LiveState, { readonly icon: LucideIcon; readonly label: string }>> = {
	down: { icon: WifiOff, label: "Reconnecting…" },
	paused: { icon: Pause, label: "Paused" },
	stale: { icon: RefreshCwOff, label: "Not updated" },
};

export function CompactLiveStatus({ state, text }: { readonly state: LiveState; readonly text: string }) {
	const problem = problems[state];
	return (
		<span
			className="text-muted-foreground data-[state=down]:text-destructive data-[state=stale]:text-destructive flex shrink-0 items-center gap-1 text-xs"
			data-state={state}
			id={shellIds.live}
			role="status"
		>
			{problem ? (
				<>
					<problem.icon aria-hidden="true" className="size-4" />
					<span aria-hidden="true">{problem.label}</span>
					<span className="sr-only">{text}</span>
				</>
			) : null}
		</span>
	);
}
