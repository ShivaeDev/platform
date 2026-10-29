import type { FleetHealth } from "#diagnostics/health.ts";
import { ObservedTime } from "./diagnosticsValues.tsx";

const waitingOn = { automation: "Waiting on automation", orchestrator: "Waiting on orchestrator" } as const;

export function SystemHealth({
	value,
	now,
	needsYou,
}: {
	readonly value: FleetHealth;
	readonly now: number;
	readonly needsYou?: number | null | undefined;
}) {
	let freshness = "Current snapshot";
	if (now < value.observedAt) {
		freshness = "Publisher clock is ahead";
	} else if (now - value.observedAt > value.staleAfterMs) {
		freshness = "Stale snapshot — Fleet has not refreshed its health";
	}

	return (
		<>
			<p className="text-muted-foreground text-xs">{freshness}</p>
			<dl className="[&_dt]:text-muted-foreground grid gap-4 text-sm">
				<div>
					<dt>Running / concurrency cap</dt>
					<dd>
						<strong>
							{value.running} / {value.concurrency}
						</strong>
					</dd>
				</div>
				<div>
					<dt>Queued</dt>
					<dd>
						<strong>{value.queued}</strong>
					</dd>
				</div>
				<div data-needs-you>
					<dt>Needs you</dt>
					<dd className="flex flex-wrap items-baseline gap-2">
						<strong>{needsYou ?? "Unavailable"}</strong>
						<a className="text-xs" href="/#needs-you">
							Open Today
						</a>
					</dd>
				</div>
				{(["orchestrator", "automation"] as const).map((owner) => (
					<div key={owner}>
						<dt>{waitingOn[owner]}</dt>
						<dd>
							<strong>{value.waiting[owner]}</strong>
						</dd>
					</div>
				))}
				<div>
					<dt>Last scheduler pass</dt>
					<dd>
						<ObservedTime at={value.lastSchedulerPass} />
					</dd>
				</div>
				<div>
					<dt>Last provider capacity rejection</dt>
					<dd>
						<CapacityRejection value={value.lastCapacityRejection} />
					</dd>
				</div>
			</dl>
		</>
	);
}

function CapacityRejection({ value }: { readonly value: FleetHealth["lastCapacityRejection"] }) {
	return value === null ? (
		"None observed"
	) : (
		<>
			{value.cause}
			<br />
			<ObservedTime at={value.at} />
		</>
	);
}
