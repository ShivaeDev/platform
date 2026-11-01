import { appGithub } from "./appGithub.ts";
import { budgetHeaders } from "./budgetHeaders.ts";

export function rejectsMutation(route: "putLabel" | "deleteComment") {
	return appGithub.trait("github", `GitHub rejects the next ${route} mutation with 401`, function* ({ server }) {
		yield* server.scriptFault(route, { kind: "status", reply: { body: { message: "Bad credentials" }, status: 401 } });
	});
}

export const mutationRateLimited = appGithub.trait("github", "GitHub refuses PUT because the core quota is exhausted", function* ({ server }) {
	yield* server.scriptFault("putLabel", {
		kind: "status",
		reply: {
			body: { message: "API rate limit exceeded" },
			headers: budgetHeaders("core", { limit: 5000, remaining: 0, reset: 3600 }),
			status: 403,
		},
	});
});
