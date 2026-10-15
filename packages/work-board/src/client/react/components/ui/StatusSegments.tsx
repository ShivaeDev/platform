export function StatusSegments({ label, counts }: { readonly label: string; readonly counts: Readonly<Record<string, number>> }) {
	const segments = Object.entries(counts).filter(([, count]) => count > 0);
	const description = Object.entries(counts)
		.map(([status, count]) => `${status}: ${count}`)
		.join(", ");
	return (
		<div aria-label={`${label}: ${description}`} className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted" role="img">
			{segments.map(([status, count]) => (
				<span className={color(status)} key={status} style={{ flexGrow: count }} />
			))}
		</div>
	);
}
function color(status: string) {
	if (["done", "completed", "accepted"].includes(status)) {
		return "bg-done";
	}
	if (["active", "running", "in-progress", "in progress"].includes(status)) {
		return "bg-agent-working";
	}
	if (status === "needs-human") {
		return "bg-needs-you";
	}
	return status === "blocked" ? "bg-blocked" : "bg-deferred";
}
