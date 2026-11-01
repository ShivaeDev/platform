import { useEffect } from "react";

export function useBrowserErrors() {
	useEffect(() => {
		function send(kind: "error" | "unhandledrejection", reason: unknown, message?: string) {
			const error = reason instanceof Error ? reason : undefined;
			void fetch("/_platform/errors", {
				body: JSON.stringify({
					kind,
					message: (error?.message ?? message ?? String(reason)).slice(0, 2048),
					stack: error?.stack?.slice(0, 8192),
					url: window.location.href.slice(0, 2048),
				}),
				headers: { "content-type": "application/json" },
				keepalive: true,
				method: "POST",
			}).catch(() => undefined);
		}
		function onError(event: ErrorEvent) {
			send("error", event.error, event.message);
		}
		function onRejection(event: PromiseRejectionEvent) {
			send("unhandledrejection", event.reason);
		}
		window.addEventListener("error", onError);
		window.addEventListener("unhandledrejection", onRejection);
		return () => {
			window.removeEventListener("error", onError);
			window.removeEventListener("unhandledrejection", onRejection);
		};
	}, []);
}
