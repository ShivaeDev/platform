import type { CodexLimits, GithubLimits, UsageWindow } from "#browser/diagnostics/schema.ts";
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
export function DiagnosticsGithub({ value, now }: { readonly value: GithubLimits; readonly now: number }) {
	const windows = (
		[
			["REST", value.core],
			["GraphQL", value.graphql],
		] as const
	).map(([name, window]) => <GithubWindow key={name} name={name} now={now} window={window} />);
	return (
		<>
			<dl className="grid gap-4 text-sm [&_dt]:text-muted-foreground">{windows}</dl>
			<p className="text-muted-foreground text-xs">Cached for one minute across all tabs.</p>
		</>
	);
}
function GithubWindow({ name, window, now }: { readonly name: string; readonly window: GithubLimits["core"]; readonly now: number }) {
	return (
		<div>
			<dt>{name}</dt>
			<dd>
				<strong>
					{window.remaining} / {window.limit}
				</strong>{" "}
				remaining
			</dd>
			<dd>
				Resets <Reset at={window.reset * 1000} now={now} />
			</dd>
		</div>
	);
}
