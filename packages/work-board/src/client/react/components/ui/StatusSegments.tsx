import { StatusChip } from "./StatusChip.tsx";

export function StatusSegments({ label, counts }: { readonly label: string; readonly counts: Readonly<Record<string, number>> }) {
	const segments = Object.entries(counts).filter(([, count]) => count > 0);
	return segments.length > 0 ? (
		<figure aria-label={label} className="m-0">
			<div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
				{segments.map(([status, count]) => (
					<span className={color(status)} key={status} style={{ flexGrow: count }} />
				))}
			</div>
			<ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0 text-xs tabular-nums">
				{segments.map(([status, count]) => (
					<li key={status}>
						<span>{count}</span> <StatusChip status={status} />
					</li>
				))}
			</ul>
		</figure>
	) : (
		<p className="m-0 text-muted-foreground text-xs">not linked</p>
	);
}
function color(status: string) {
	if (["done", "completed", "accepted"].includes(status)) {
		return "bg-done";
	}
	if (["active", "running", "in-progress"].includes(status)) {
		return "bg-agent-working";
	}
	if (status === "needs-human") {
		return "bg-needs-you";
	}
	return status === "blocked" ? "bg-blocked" : "bg-deferred";
}
