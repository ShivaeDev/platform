import type { AnyRouter } from "@tanstack/react-router";

// Router context callers start a navigation and do not wait for TanStack's Promise.
export function navigateTo(router: AnyRouter, href: string): void {
	void router.navigate({ href });
}
