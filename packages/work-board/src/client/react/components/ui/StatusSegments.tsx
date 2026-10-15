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
export function StatusSegments({
	counts,
	label,
	large = false,
}: {
	readonly counts: Readonly<Record<string, number>>;
	readonly label: string;
	readonly large?: boolean;
}) {
	const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
	const description = entries.map(([status, count]) => `${status}: ${count}`).join(", ") || "No linked work";
	return (
		<section aria-label={label} className={large ? "space-y-3" : undefined} data-goal-counts={large ? true : undefined}>
			<div
				aria-label={`${label}: ${description}`}
				className={large ? "flex h-8 overflow-hidden rounded-lg bg-muted" : "my-1 flex h-1.5 w-full overflow-hidden rounded-full bg-muted"}
				role="img"
				title={description}
			>
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
			{large ? (
				<ul className="!p-0 !list-none flex flex-wrap gap-x-5 gap-y-2">
					{entries.map(([status, count]) => (
						<li className="flex items-center gap-2" key={status}>
							<span aria-hidden="true" className={`size-2 rounded-full ${colors[statusPresentation(status).token]}`} />
							<strong>{count}</strong> <StatusChip status={status} />
						</li>
					))}
				</ul>
			) : null}
		</section>
	);
}
