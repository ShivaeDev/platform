import { Effect, Layer, Redacted } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { requireAdmin } from "@shivaedev/platform/rpc/requireAdmin.ts";
import { type SessionPolicy, type UserSessionShape, withSessionUser } from "@shivaedev/platform/server/rpc-server/session.ts";
import { checkDashboardVersion } from "./checkDashboardVersion.ts";
import { readOnlyDashboard } from "./readOnlyDashboard.ts";

const authorizationErrors = {
	AuthUnavailable: () => Effect.succeed(HttpServerResponse.empty({ status: 503 })),
	Forbidden: () => Effect.succeed(HttpServerResponse.empty({ status: 403 })),
	Unauthorized: () => Effect.succeed(HttpServerResponse.empty({ status: 401 })),
};

export function jobDashboard(databaseUrl: Redacted.Redacted<string>, sessions: SessionPolicy<UserSessionShape>) {
	return Layer.unwrap(
		Effect.gen(function* () {
			yield* checkDashboardVersion;
			const dashboard = yield* readOnlyDashboard(Redacted.value(databaseUrl));
			function handle(request: HttpServerRequest.HttpServerRequest) {
				return Effect.gen(function* () {
					yield* requireAdmin;
					if (request.method !== "GET" && request.method !== "HEAD") {
						return HttpServerResponse.text("The job board is read-only", { status: 403 });
					}
					const web = yield* HttpServerRequest.toWeb(request);
					const response = HttpServerResponse.fromWeb(yield* Effect.tryPromise(() => dashboard(web)));
					return HttpServerResponse.setHeader(response, "cache-control", "private, no-store");
				}).pipe(
					withSessionUser(sessions, request.headers, "job-dashboard"),
					Effect.catchTags(authorizationErrors),
					Effect.catch(() => Effect.succeed(HttpServerResponse.text("Job board is temporarily unavailable", { status: 503 }))),
				);
			}
			return HttpRouter.use((router) => Effect.all([router.add("*", "/admin/jobs/*", handle), router.add("*", "/admin/jobs.data", handle)]));
		}),
	);
}
