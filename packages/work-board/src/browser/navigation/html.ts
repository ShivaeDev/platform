import type { Navigation } from "#browser/Navigation.ts";
export function navigationHtml(data: Navigation): string {
	const count = String(data.inboxCount ?? "?");
	return `<a id="home-open" href="/" data-inbox-count="${count}">Today <span id="inbox-count" class="inbox-count" aria-label="${count} waiting">${count}</span></a><a href="/_board/goals">Goals (${data.counts.goals})</a><a id="work-open" href="/_board/work">Now (${data.counts.now})</a><a href="/_board/library">Library (${data.counts.library})</a><a id="diagnostics-open" href="/_board/diagnostics">System (${data.counts.system})</a>`;
}
