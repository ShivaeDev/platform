export function remainingRoute(pathname: string) {
	switch (pathname) {
		case "/_board/changes":
			return "changes";
		case "/_board/diagnostics":
			return "diagnostics";
		case "/_board/start":
			return "start";
		case "/_board/respond":
			return "respond";
		case "/_board/handoff":
			return "handoff";
		case "/_board/result":
			return "result";
		default:
			return undefined;
	}
}
export type RemainingRoute = NonNullable<ReturnType<typeof remainingRoute>>;
