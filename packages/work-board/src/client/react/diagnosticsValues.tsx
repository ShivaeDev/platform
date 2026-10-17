import type { CodexLimits, GithubLimits, GithubWindow, UsageWindow } from "#browser/diagnostics/schema.ts";
import { resetLabel } from "#diagnostics/resetLabel.ts";
export function ObservedTime({ at }: { readonly at: number | null }) {
	return at === null ? (
		"Not reported"
	) : (
		<time dateTime={new Date(at).toISOString()}>
			{new Date(at)
				.toISOString()
				.replace("T", " ")
				.replace(/\.\d{3}Z$/u, " UTC")}
		</time>
	);
}
function Reset({ at, now }: { readonly at: number | null; readonly now: number }) {
	return at === null ? (
		"Not reported"
	) : (
		<time data-reset dateTime={new Date(at).toISOString()}>
			{resetLabel(at, now)}
		</time>
	);
}
function windowLabel(name: string, minutes: number | null) {
	if (minutes === null) {
		return `${name} — duration not reported`;
	}
	if (minutes === 10_080) {
		return "Weekly";
	}
	for (const [duration, unit] of [
		[1440, "day"],
		[60, "hour"],
	] as const) {
		if (minutes % duration === 0) {
			return `${minutes / duration}-${unit}`;
		}
	}
	return `${minutes}-minute`;
}
function Usage({ name, window, now }: { readonly name: string; readonly window: UsageWindow | null; readonly now: number }) {
	if (!window) {
		return (
			<li>
				<h3>{name}</h3>
				<p>Window not reported</p>
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
			<p>
				Resets <Reset at={window.resetsAt === null ? null : window.resetsAt * 1000} now={now} />
			</p>
		</li>
	);
}
export function DiagnosticsWindows({ value, now }: { readonly value: CodexLimits; readonly now: number }) {
	return (
		<ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 [&_meter]:w-full">
			<Usage name="Primary" now={now} window={value.primary} />
			<Usage name="Secondary" now={now} window={value.secondary} />
		</ul>
	);
}
const GITHUB_RESOURCES: Readonly<Record<string, string>> = { core: "REST", graphql: "GraphQL", search: "Search" };
const GITHUB_PAUSES = { "rate-limit": "Rate-limited", reserve: "GitHub paused below the 20% reserve" } as const;
export function DiagnosticsGithub({ value, now }: { readonly value: GithubLimits; readonly now: number }) {
	return (
		<>
			<dl className="grid gap-4 text-sm [&_dt]:text-muted-foreground">
				{value.map((window) => (
					<GithubResource key={window.resource} now={now} window={window} />
				))}
			</dl>
			<p className="text-muted-foreground text-xs">Recorded from the rate-limit headers of Fleet's own GitHub responses.</p>
		</>
	);
}
function GithubResource({ window, now }: { readonly window: GithubWindow; readonly now: number }) {
	return (
		<div data-resource={window.resource}>
			<dt>{GITHUB_RESOURCES[window.resource] ?? window.resource}</dt>
			<dd>
				<strong>
					{window.remaining} / {window.limit}
				</strong>{" "}
				remaining
			</dd>
			{window.limitedUntil !== null && window.limitedUntil > now ? (
				<dd>
					<strong>{GITHUB_PAUSES[window.limitedBy ?? "rate-limit"]}</strong> until <Reset at={window.limitedUntil} now={now} />
				</dd>
			) : null}
			<dd>
				Resets <Reset at={window.reset * 1000} now={now} />
			</dd>
			<dd>
				Observed <time dateTime={new Date(window.observedAt).toISOString()}>{resetLabel(window.observedAt, now)}</time>
			</dd>
		</div>
	);
}
