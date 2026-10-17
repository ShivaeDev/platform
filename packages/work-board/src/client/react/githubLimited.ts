import type { GithubWindow } from "#browser/diagnostics/schema.ts";

export function githubLimited(window: GithubWindow, now: number) {
	return window.remaining === 0 || (window.limitedUntil !== null && window.limitedUntil > now);
}
