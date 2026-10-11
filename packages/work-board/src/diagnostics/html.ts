import { escapeHtml } from "#page/escape.ts";
import type { FleetHealth } from "./health.ts";
import { resetLabel } from "./resetLabel.ts";
import type { CodexLimits, GithubLimits, Observation, UsageWindow } from "./source.ts";

function time(milliseconds: number | null): string {
	return milliseconds === null
		? "Not reported"
		: `<time datetime="${new Date(milliseconds).toISOString()}">${new Date(milliseconds)
				.toISOString()
				.replace("T", " ")
				.replace(/\.\d{3}Z$/u, " UTC")}</time>`;
}
function observed(at: number): string {
	return `<p class="diagnostics-freshness">Observed ${time(at)}</p>`;
}
function card<A>(name: string, source: Observation<A>, render: (value: A) => string, attention = false, stale = false): string {
	let state: Observation<A>["state"] | "attention" | "stale" = source.state;
	if (state === "ready" && attention) {
		state = "attention";
	}
	if (source.state === "ready" && stale) {
		state = "stale";
	}
	const label = { attention: "Needs attention", error: "Unavailable", "not-configured": "Not configured", ready: "Available", stale: "Stale" }[state];
	return `<section class="diagnostics-card" data-source="${name.toLowerCase()}" data-state="${state}" aria-labelledby="diagnostics-${name.toLowerCase()}"><header><h2 id="diagnostics-${name.toLowerCase()}">${name}</h2><span class="diagnostics-status">${label}</span></header>${source.state === "ready" ? render(source.value) : `<p role="status">${escapeHtml(source.cause)}</p>`}${observed(source.observedAt)}</section>`;
}
function reset(at: number | null, now: number): string {
	return at === null ? "Not reported" : `<time data-reset datetime="${new Date(at).toISOString()}">${resetLabel(at, now)}</time>`;
}
function windowLabel(name: string, minutes: number | null): string {
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
function usage(name: string, window: UsageWindow | null, now: number): string {
	if (window === null) {
		return `<li><h3>${name}</h3><p>Window not reported</p></li>`;
	}
	const label = windowLabel(name, window.windowDurationMins);
	return `<li><h3>${label}</h3><p><strong>${window.usedPercent}% used</strong></p><meter min="0" max="100" value="${Math.min(window.usedPercent, 100)}" aria-label="${label} percent used">${window.usedPercent}%</meter><p>Resets ${reset(window.resetsAt === null ? null : window.resetsAt * 1000, now)}</p></li>`;
}
function codex(value: CodexLimits, now: number): string {
	return `<ul class="diagnostics-windows">${usage("Primary", value.primary, now)}${usage("Secondary", value.secondary, now)}</ul>`;
}
function github(value: GithubLimits, now: number): string {
	return `<dl class="diagnostics-metrics">${(
		[
			["REST", value.core],
			["GraphQL", value.graphql],
		] as const
	)
		.map(
			([name, window]) =>
				`<div><dt>${name}</dt><dd><strong>${window.remaining} / ${window.limit}</strong> remaining</dd><dd>Resets ${reset(window.reset * 1000, now)}</dd></div>`,
		)
		.join("")}</dl><p class="diagnostics-freshness">Cached for one minute across all tabs.</p>`;
}
function fleet(value: FleetHealth, now: number): string {
	let freshness = "Current snapshot";
	if (now < value.observedAt) {
		freshness = "Publisher clock is ahead";
	} else if (now - value.observedAt > value.staleAfterMs) {
		freshness = "Stale snapshot — Fleet may be stopped or unable to publish";
	}
	return `<p class="diagnostics-freshness">${freshness}</p><dl class="diagnostics-metrics"><div><dt>Running / concurrency cap</dt><dd><strong>${value.running} / ${value.concurrency}</strong></dd></div><div><dt>Queued</dt><dd><strong>${value.queued}</strong></dd></div><div><dt>Needs human</dt><dd><strong>${value.needsHuman}</strong></dd></div><div><dt>Last scheduler pass</dt><dd>${time(value.lastSchedulerPass)}</dd></div><div><dt>Last provider capacity rejection</dt><dd>${value.lastCapacityRejection === null ? "None observed" : `${escapeHtml(value.lastCapacityRejection.cause)}<br>${time(value.lastCapacityRejection.at)}`}</dd></div></dl>`;
}

export function diagnosticsHtml(
	sources: { readonly codex: Observation<CodexLimits>; readonly github: Observation<GithubLimits>; readonly fleet: Observation<FleetHealth> },
	now: number,
): string {
	const fleetSource = sources.fleet.state === "ready" ? { ...sources.fleet, observedAt: sources.fleet.value.observedAt } : sources.fleet;
	return `<div class="diagnostics"><h1>Diagnostics</h1><p>Agent usage and Fleet health. Refreshes every 15 seconds while this view is visible; Pause updates holds the current view.</p><div class="diagnostics-grid">${card("Codex", sources.codex, (value) => codex(value, now), sources.codex.state === "ready" && [sources.codex.value.primary, sources.codex.value.secondary].some((window) => window !== null && window.usedPercent >= 90))}${card("GitHub", sources.github, (value) => github(value, now), sources.github.state === "ready" && [sources.github.value.core, sources.github.value.graphql].some((window) => window.remaining === 0))}${card("Fleet", fleetSource, (value) => fleet(value, now), fleetSource.state === "ready" && (fleetSource.value.running >= fleetSource.value.concurrency || fleetSource.value.needsHuman > 0 || now < fleetSource.value.observedAt), fleetSource.state === "ready" && now - fleetSource.value.observedAt > fleetSource.value.staleAfterMs)}</div></div>`;
}
