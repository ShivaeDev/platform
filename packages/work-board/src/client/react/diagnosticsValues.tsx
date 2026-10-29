import type { CodexLimits, GithubLimits, GithubWindow, UsageWindow } from "#browser/diagnostics/schema.ts";
import { sentenceLabel } from "#browser/views/statusLabel.ts";
import { Time } from "./Time.tsx";
export function ObservedTime({ at }: { readonly at: number | null }) {
	return at === null ? "Not reported" : <Time at={at} />;
}
function windowLabel(name: string, minutes: number | null) {
	if (minutes === null) {
		return `${name} (length not reported)`;
	}
	if (minutes === 10_080) {
		return "Weekly limit";
	}
	for (const [duration, unit] of [
		[1440, "day"],
		[60, "hour"],
	] as const) {
		if (minutes % duration === 0) {
			return `${minutes / duration}-${unit} limit`;
		}
	}
	return `${minutes}-minute limit`;
}
function Usage({ name, window }: { readonly name: string; readonly window: UsageWindow | null }) {
	if (!window) {
		return (
			<li>
				<h3>{name}</h3>
				<p>Not reported</p>
			</li>
		);
	}
	const label = windowLabel(name, window.windowDurationMins);
	return (
		<li>
			<h3>{label}</h3>
			<p>
				<strong>{window.usedPercent}% used</strong>
			</p>
			<meter aria-label={`${label} percent used`} max={100} min={0} value={Math.min(window.usedPercent, 100)}>
				{window.usedPercent}%
			</meter>
			<p>Resets {window.resetsAt === null ? "Not reported" : <Time at={window.resetsAt * 1000} />}</p>
		</li>
	);
}
export function DiagnosticsWindows({ value }: { readonly value: CodexLimits }) {
	return (
		<ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 [&_meter]:w-full">
			<Usage name="Short limit" window={value.primary} />
			<Usage name="Long limit" window={value.secondary} />
		</ul>
	);
}
const GITHUB_RESOURCES: Readonly<Record<string, string>> = { core: "REST API", graphql: "GraphQL API", search: "Search API" };
const GITHUB_PAUSES = { "rate-limit": "GitHub is blocking requests", reserve: "Fleet paused to keep 20% in reserve" } as const;
export function DiagnosticsGithub({ value, now }: { readonly value: GithubLimits; readonly now: number }) {
	return (
		<>
			<dl className="[&_dt]:text-muted-foreground grid gap-4 text-sm">
				{value.map((window) => (
					<GithubResource key={window.resource} now={now} window={window} />
				))}
			</dl>
			<p className="text-muted-foreground text-xs">Fleet reads these limits from its own GitHub requests. The Board does not call GitHub.</p>
		</>
	);
}
function GithubResource({ window, now }: { readonly window: GithubWindow; readonly now: number }) {
	return (
		<div data-resource={window.resource}>
			<dt>{GITHUB_RESOURCES[window.resource] ?? `${sentenceLabel(window.resource)} API`}</dt>
			<dd>
				<strong>
					{window.remaining} of {window.limit}
				</strong>{" "}
				requests left
			</dd>
			{window.limitedUntil !== null && window.limitedUntil > now ? (
				<dd>
					<strong>{GITHUB_PAUSES[window.limitedBy ?? "rate-limit"]}</strong>. Resumes <Time at={window.limitedUntil} />
				</dd>
			) : null}
			<dd>
				Resets <Time at={window.reset * 1000} />
			</dd>
			<dd>
				Checked <Time at={window.observedAt} />
			</dd>
		</div>
	);
}
