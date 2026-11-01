import { appGithub } from "./appGithub.ts";
import { budgetHeaders } from "./budgetHeaders.ts";

export type AppRoute = "app" | "installation" | "token";
export type AppLimit = "primary" | "secondary" | "message";

export function appRateLimited(route: AppRoute, limit: AppLimit, repeat = false) {
	const headers =
		limit === "message"
			? {}
			: {
					...budgetHeaders("core", { limit: 5000, remaining: limit === "primary" ? 0 : 100, reset: 120 }),
					...(limit === "secondary" ? { "retry-after": "30" } : {}),
				};
	return appGithub.trait("github", `GitHub refuses ${route} with a ${limit} rate limit`, function* ({ server }) {
		yield* server.scriptFault(
			route,
			{
				kind: "status",
				reply: {
					body: { message: "You have exceeded a secondary rate limit" },
					headers,
					status: limit === "secondary" ? 429 : 403,
				},
			},
			{ repeat },
		);
	});
}
