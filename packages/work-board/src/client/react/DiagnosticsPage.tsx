import type { ReactNode } from "react";
import type { Observation } from "#browser/diagnostics/schema.ts";
import type { DiagnosticsProjection } from "#browser/views/remaining.ts";
import { DiagnosticsFleet } from "./DiagnosticsFleet.tsx";
import { DiagnosticsGithub, DiagnosticsWindows, ObservedTime } from "./diagnosticsValues.tsx";
export function DiagnosticsPage({ data: { sources: data, now } }: { readonly data: DiagnosticsProjection }) {
	const fleet = data.fleet.state === "ready" ? { ...data.fleet, observedAt: data.fleet.value.observedAt } : data.fleet;
	return (
		<div className="diagnostics">
			<h1>Diagnostics</h1>
			<nav aria-label="System views" className="my-4 flex flex-wrap gap-4">
				<a href="/_board/overview">Overview</a>
				<a href="/_board/changes">Changes</a>
				<a href="/_board/start">Getting started</a>
			</nav>
			<p>Agent usage and Fleet health. Refreshes every 15 seconds while this view is visible; Pause updates holds the current view.</p>
			<div className="diagnostics-grid">
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
					attention={data.github.state === "ready" && [data.github.value.core, data.github.value.graphql].some((window) => window.remaining === 0)}
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
					render={(value) => <DiagnosticsFleet now={now} value={value} />}
					source={fleet}
					stale={fleet.state === "ready" && now - fleet.value.observedAt > fleet.value.staleAfterMs}
				/>
			</div>
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
		<section aria-labelledby={`diagnostics-${name.toLowerCase()}`} className="diagnostics-card" data-source={name.toLowerCase()} data-state={state}>
			<header>
				<h2 id={`diagnostics-${name.toLowerCase()}`}>{name}</h2>
				<span className="diagnostics-status">{label}</span>
			</header>
			{source.state === "ready" ? render(source.value) : <p role="status">{source.cause}</p>}
			<p className="diagnostics-freshness">
				Observed <ObservedTime at={source.observedAt} />
			</p>
		</section>
	);
}
