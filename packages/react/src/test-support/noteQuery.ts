import { queryRoute } from "#queryRoute.ts";
import type { RouterSearch, root } from "./routerApp.ts";

export const noteQuery = queryRoute(
	({ context, params, search }: { context: typeof root.types.allContext; params: { id: string }; search: typeof RouterSearch.Type }) =>
		context.client.api.get.query({ ...params, page: search.page * context.viewer.page }),
);
