import { channel } from "node:diagnostics_channel";
import { IncomingMessage, ServerResponse } from "node:http";
import { Effect, Predicate } from "effect";

export const browserAuthRequests = Effect.fn("BrowserAuthStory.browserAuthRequests")(function* (baseUrl: string) {
	const signIns: number[] = [];
	const sessions: string[][] = [];
	const requests = channel("http.server.request.start");
	function observe(message: unknown) {
		if (
			!(
				Predicate.hasProperty(message, "request")
				&& Predicate.hasProperty(message, "response")
				&& message.request instanceof IncomingMessage
				&& message.response instanceof ServerResponse
			)
		) {
			throw new Error("Expected a Node HTTP server request diagnostic");
		}
		const { request, response } = message;
		if (request.headers.host !== new URL(baseUrl).host) {
			return;
		}
		if (request.url === "/api/auth/sign-in/email") {
			response.once("finish", () => {
				signIns.push(response.statusCode);
			});
		}
		if (request.url?.startsWith("/api/auth/get-session")) {
			sessions.push(
				(request.headers.cookie ?? "")
					.split(";")
					.map((cookie) => cookie.trim())
					.filter(Boolean),
			);
		}
	}
	yield* Effect.acquireRelease(
		Effect.sync(() => requests.subscribe(observe)),
		() => Effect.sync(() => requests.unsubscribe(observe)),
	);
	return {
		adoption: () => ({
			requests: sessions.map((cookies) => cookies.map((cookie) => cookie.split("=")[0])),
			signIns,
		}),
	};
});
