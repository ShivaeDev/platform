import { useBrowserErrors } from "#client/adapters/useBrowserErrors.ts";

export function Reporter() {
	useBrowserErrors();
	return null;
}
