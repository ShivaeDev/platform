import { type ReactNode, useContext } from "react";
import type { Observation } from "#browser/diagnostics/schema.ts";
import type { DiagnosticsProjection } from "#browser/views/remaining.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { CardAction, CardContent, CardFooter, CardHeader, CardTitle, Card as Surface } from "#client/react/components/ui/card.tsx";
import { DiagnosticsGithub, DiagnosticsWindows, ObservedTime } from "./diagnosticsValues.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { githubLimited } from "./githubLimited.ts";
import { PageHeader } from "./PageHeader.tsx";
import { SystemFleetLane } from "./SystemFleetLane.tsx";
import { SystemFleetStopped } from "./SystemFleetStopped.tsx";
import { SystemHealth } from "./SystemHealth.tsx";
import { SystemSourceProblems } from "./SystemSourceProblems.tsx";
export function SystemPage({
	data,
	needsYou,
	sourceProblems,
}: {
	readonly data: DiagnosticsProjection;
	readonly needsYou?: number | null | undefined;
	readonly sourceProblems?: Parameters<typeof SystemSourceProblems>[0];
}) {
	const fleet = data.sources.fleet;
	return (
		<div className="space-y-6">
			<PageHeader
				summary="Agent usage, Fleet health and workspace source problems. Refreshes every 15 seconds while this view is visible; Pause updates holds the current view."
				title="System"
			/>
			{fleet.state === "error" && fleet.startCommand !== undefined ? (
				<SystemFleetStopped command={fleet.startCommand} observedAt={fleet.observedAt} reason={fleet.cause} />
			) : (
				<FleetSources data={data} needsYou={needsYou} />
			)}
			{sourceProblems !== undefined && <SystemSourceProblems {...sourceProblems} />}
		</div>
	);
}

function FleetSources({
	data: { sources: data, now },
	needsYou,
}: {
	readonly data: DiagnosticsProjection;
	readonly needsYou?: number | null | undefined;
}) {
	const items = useContext(FleetItemsContext);
	const fleet = data.fleet.state === "ready" ? { ...data.fleet, observedAt: data.fleet.value.observedAt } : data.fleet;
	return (
		<>
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
					attention={fleet.state === "ready" && (fleet.value.running >= fleet.value.concurrency || now < fleet.value.observedAt)}
					name="Fleet"
					render={(value) => <SystemHealth needsYou={needsYou} now={now} value={value} />}
					source={fleet}
					stale={fleet.state === "ready" && now - fleet.value.observedAt > fleet.value.staleAfterMs}
				/>
			</div>
			<SystemFleetLane data={items} />
		</>
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
		<article
			aria-labelledby={`diagnostics-${name.toLowerCase()}`}
			className="min-w-0 [overflow-wrap:anywhere]"
			data-source={name.toLowerCase()}
			data-state={state}
		>
			<Surface className="h-full">
				<CardHeader>
					<CardTitle>
						<h2 className="text-lg" id={`diagnostics-${name.toLowerCase()}`}>
							{name}
						</h2>
					</CardTitle>
					<CardAction>
						<Badge variant="secondary">{label}</Badge>
					</CardAction>
				</CardHeader>
				<CardContent className="space-y-4">{source.state === "ready" ? render(source.value) : <p role="status">{source.cause}</p>}</CardContent>
				<CardFooter className="mt-auto text-muted-foreground text-xs">
					<p>
						Observed <ObservedTime at={source.observedAt} />
					</p>
				</CardFooter>
			</Surface>
		</article>
	);
}
