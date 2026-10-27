import { Effect } from "effect";
import type { AdminHost } from "./adminHost.ts";

export function adminRouteVerbs(host: AdminHost, story: { tell: (line: string) => void }) {
	return {
		adminHandlerRequests: Effect.fn("AuthStory.adminHandlerRequests")(function* () {
			story.tell("read the requests received by the admin route handler");
			return yield* Effect.sync(() => [...host.state.handlerRequests]);
		}),
		failSessionProvider: Effect.fn("AuthStory.failSessionProvider")(function* () {
			story.tell("make the session provider fail with AuthUnavailable");
			yield* Effect.sync(() => {
				host.state.providerUnavailable = true;
			});
		}),
		openAdminTools: Effect.fn("AuthStory.openAdminTools")(function* (method: "GET" | "POST" = "GET", origin?: string) {
			story.tell(`request the admin-only HTTP route with ${method}`);
			const headers = new Headers(host.headers);
			if (origin !== undefined) {
				headers.set("origin", origin);
			}
			const response = yield* Effect.promise(() => fetch(`${host.baseUrl}/admin-tools`, { headers, method }));
			return { body: yield* Effect.promise(() => response.text()), status: response.status };
		}),
		openFailingAdminTools: Effect.fn("AuthStory.openFailingAdminTools")(function* () {
			story.tell("request an admin handler that fails in its typed error channel");
			const response = yield* Effect.promise(() => fetch(`${host.baseUrl}/admin-failure`, { headers: host.headers }));
			return { body: yield* Effect.promise(() => response.text()), status: response.status };
		}),
	};
}
