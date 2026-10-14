import { StatusChip } from "./StatusChip.tsx";
import { statusPresentation } from "./statusPresentation.ts";

const colors = {
	"agent-working": "bg-agent-working",
	blocked: "bg-blocked",
	deferred: "bg-deferred",
	done: "bg-done",
	"needs-you": "bg-needs-you",
	"waiting-on-agents": "bg-waiting-on-agents",
};
export function StatusSegments({ counts, label }: { readonly counts: Readonly<Record<string, number>>; readonly label: string }) {
	const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
	return (
		<section aria-label={label} className="space-y-3" data-goal-counts>
			<div aria-hidden="true" className="flex h-8 overflow-hidden rounded-lg bg-muted">
				{entries.map(([status, count]) => (
					<span
						className={`border-background border-r ${colors[statusPresentation(status).token]}`}
						data-count={count}
						data-status={status}
						key={status}
						style={{ flex: count }}
					/>
				))}
			</div>
			<ul className="!p-0 !list-none flex flex-wrap gap-x-5 gap-y-2">
				{entries.map(([status, count]) => (
					<li className="flex items-center gap-2" key={status}>
						<span aria-hidden="true" className={`size-2 rounded-full ${colors[statusPresentation(status).token]}`} />
						<strong>{count}</strong> <StatusChip status={status} />
					</li>
				))}
			</ul>
		</section>
	);
}
