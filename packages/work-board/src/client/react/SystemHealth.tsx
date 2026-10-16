import type { FleetHealth } from "#diagnostics/health.ts";
import { ObservedTime } from "./diagnosticsValues.tsx";
export function SystemHealth({ value, now }: { readonly value: FleetHealth; readonly now: number }) {
	let freshness = "Current snapshot";
	if (now < value.observedAt) {
		freshness = "Publisher clock is ahead";
	} else if (now - value.observedAt > value.staleAfterMs) {
		freshness = "Stale snapshot — Fleet has not refreshed its health";
	}

	return (
		<>
			<p className="text-muted-foreground text-xs">{freshness}</p>
			<dl className="grid gap-4 text-sm [&_dt]:text-muted-foreground">
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
				{Object.entries(value.waiting).map(([owner, count]) => (
					<div key={owner}>
						<dt>Waiting on {owner}</dt>
						<dd>
							<strong>{count}</strong>
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
