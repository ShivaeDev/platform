import { escapeHtml } from "#page/escape.ts";
import type { FleetHealth } from "./health.ts";
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
function card<A>(name: string, source: Observation<A>, render: (value: A) => string, attention = false): string {
	let state: Observation<A>["state"] | "attention" = source.state;
	if (state === "ready" && attention) {
		state = "attention";
	}
	const label = { attention: "Needs attention", error: "Unavailable", "not-configured": "Not configured", ready: "Available" }[state];
	return `<section class="diagnostics-card" data-source="${name.toLowerCase()}" data-state="${state}" aria-labelledby="diagnostics-${name.toLowerCase()}"><header><h2 id="diagnostics-${name.toLowerCase()}">${name}</h2><span class="diagnostics-status">${label}</span></header>${source.state === "ready" ? render(source.value) : `<p role="status">${escapeHtml(source.cause)}</p>`}${observed(source.observedAt)}</section>`;
}
function usage(name: string, window: UsageWindow | null): string {
	if (window === null) {
		return `<li><h3>${name}</h3><p>Window not reported</p></li>`;
	}
	const duration = window.windowDurationMins === null ? "Duration not reported" : `${window.windowDurationMins} minute window`;
	return `<li><h3>${name}</h3><p><strong>${window.usedPercent}% used</strong> · ${duration}</p><meter min="0" max="100" value="${Math.min(window.usedPercent, 100)}" aria-label="${name} percent used">${window.usedPercent}%</meter><p>Resets ${time(window.resetsAt === null ? null : window.resetsAt * 1000)}</p></li>`;
}
function codex(value: CodexLimits): string {
	return `<ul class="diagnostics-windows">${usage("Primary", value.primary)}${usage("Secondary", value.secondary)}</ul>`;
}
function github(value: GithubLimits): string {
	return `<dl class="diagnostics-metrics">${(
		[
			["REST", value.core],
			["GraphQL", value.graphql],
		] as const
	)
		.map(
			([name, window]) =>
				`<div><dt>${name}</dt><dd><strong>${window.remaining} / ${window.limit}</strong> remaining</dd><dd>Resets ${time(window.reset * 1000)}</dd></div>`,
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
	return `<p class="diagnostics-freshness">${freshness}</p><p class="diagnostics-freshness">Published ${time(value.observedAt)}</p><dl class="diagnostics-metrics"><div><dt>Running / concurrency cap</dt><dd><strong>${value.running} / ${value.concurrency}</strong></dd></div><div><dt>Queued</dt><dd><strong>${value.queued}</strong></dd></div><div><dt>Needs human</dt><dd><strong>${value.needsHuman}</strong></dd></div><div><dt>Last scheduler pass</dt><dd>${time(value.lastSchedulerPass)}</dd></div><div><dt>Last provider capacity rejection</dt><dd>${value.lastCapacityRejection === null ? "None observed" : `${escapeHtml(value.lastCapacityRejection.cause)}<br>${time(value.lastCapacityRejection.at)}`}</dd></div></dl>`;
}

export function diagnosticsHtml(
	sources: { readonly codex: Observation<CodexLimits>; readonly github: Observation<GithubLimits>; readonly fleet: Observation<FleetHealth> },
	now: number,
): string {
	return `<div class="diagnostics"><h1>Diagnostics</h1><p>Agent usage and Fleet health. Refreshes every 15 seconds while this view is visible; Pause updates holds the current view.</p><div class="diagnostics-grid">${card("Codex", sources.codex, codex, sources.codex.state === "ready" && [sources.codex.value.primary, sources.codex.value.secondary].some((window) => window !== null && window.usedPercent >= 90))}${card("GitHub", sources.github, github, sources.github.state === "ready" && [sources.github.value.core, sources.github.value.graphql].some((window) => window.remaining === 0))}${card("Fleet", sources.fleet, (value) => fleet(value, now), sources.fleet.state === "ready" && (sources.fleet.value.running >= sources.fleet.value.concurrency || sources.fleet.value.needsHuman > 0 || now - sources.fleet.value.observedAt > sources.fleet.value.staleAfterMs || now < sources.fleet.value.observedAt))}</div></div>`;
}
