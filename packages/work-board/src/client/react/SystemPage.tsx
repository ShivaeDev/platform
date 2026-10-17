import { type ReactNode, useContext } from "react";
import type { Observation } from "#browser/diagnostics/schema.ts";
import type { DiagnosticsProjection } from "#browser/views/remaining.ts";
import { Card as Surface } from "#client/react/components/ui/Card.tsx";
import { githubLimited } from "#diagnostics/githubLimited.ts";
import { DiagnosticsGithub, DiagnosticsWindows, ObservedTime } from "./diagnosticsValues.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { SystemFleetLane } from "./SystemFleetLane.tsx";
import { SystemHealth } from "./SystemHealth.tsx";
export function SystemPage({ data: { sources: data, now } }: { readonly data: DiagnosticsProjection }) {
	const items = useContext(FleetItemsContext);
	const fleet = data.fleet.state === "ready" ? { ...data.fleet, observedAt: data.fleet.value.observedAt } : data.fleet;
	return (
		<div className="space-y-6">
			<h1 className="font-semibold text-2xl">System</h1>
			<p>Agent usage and Fleet health. Refreshes every 15 seconds while this view is visible; Pause updates holds the current view.</p>
			<div className="grid gap-4 lg:grid-cols-2">
				<Card
					attention={
						data.codex.state === "ready"
						&& [data.codex.value.primary, data.codex.value.secondary].some((window) => window !== null && window.usedPercent >= 90)
					}
					name="Codex"
					render={(value) => <DiagnosticsWindows now={now} value={value} />}
					source={data.codex}
				/>
				<Card
					attention={data.github.state === "ready" && data.github.value.some((window) => githubLimited(window, now))}
					name="GitHub"
					render={(value) => <DiagnosticsGithub now={now} value={value} />}
					source={data.github}
				/>
				<Card
					attention={
						fleet.state === "ready"
						&& (fleet.value.running >= fleet.value.concurrency
							|| Object.values(fleet.value.waiting).some((count) => count > 0)
							|| now < fleet.value.observedAt)
					}
					name="Fleet"
					render={(value) => <SystemHealth now={now} value={value} />}
					source={fleet}
					stale={fleet.state === "ready" && now - fleet.value.observedAt > fleet.value.staleAfterMs}
				/>
			</div>
			<SystemFleetLane data={items} />
		</div>
	);
}
function Card<A>({
	name,
	source,
	attention,
	stale,
	render,
}: {
	readonly name: string;
	readonly source: Observation<A>;
	readonly attention: boolean;
	readonly stale?: boolean;
	readonly render: (value: A) => ReactNode;
}) {
	let state: Observation<A>["state"] | "attention" | "stale" = source.state;
	if (source.state === "ready" && attention) {
		state = "attention";
	}
	if (source.state === "ready" && stale) {
		state = "stale";
	}
	const label = { attention: "Needs attention", error: "Unavailable", "not-configured": "Not configured", ready: "Available", stale: "Stale" }[state];
	return (
		<Surface
			aria-labelledby={`diagnostics-${name.toLowerCase()}`}
			className="min-w-0 space-y-4 [overflow-wrap:anywhere]"
			data-source={name.toLowerCase()}
			data-state={state}
		>
			<header className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="font-semibold text-lg" id={`diagnostics-${name.toLowerCase()}`}>
					{name}
				</h2>
				<span className="rounded-full bg-muted px-2 py-1 text-xs">{label}</span>
			</header>
			{source.state === "ready" ? render(source.value) : <p role="status">{source.cause}</p>}
			<p className="text-muted-foreground text-xs">
				Observed <ObservedTime at={source.observedAt} />
			</p>
		</Surface>
	);
}
