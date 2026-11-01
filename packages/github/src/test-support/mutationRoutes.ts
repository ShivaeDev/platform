import * as HttpStatus from "effect/http/HttpStatus";
import { budgetHeaders } from "./budgetHeaders.ts";

export const mutationRoutes = {
	deleteComment: {
		method: "DELETE",
		path: "/repos/acme/widgets/issues/comments/7",
		reply: () => ({ headers: budgetHeaders("core", { limit: 5000, remaining: 4988, reset: 3600 }), status: HttpStatus.fromLiteral("NoContent") }),
	},
	putLabel: {
		method: "PUT",
		path: "/repos/acme/widgets/issues/1/labels",
		reply: () => ({ body: [{ name: "ready" }], headers: budgetHeaders("core", { limit: 5000, remaining: 4989, reset: 3600 }) }),
	},
	putSubscription: {
		method: "PUT",
		path: "/repos/acme/widgets/subscription",
		reply: () => ({ status: HttpStatus.fromLiteral("NoContent") }),
	},
};
