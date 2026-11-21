import { queryRoute } from "#client/adapters/queryRoute.ts";
import type { RouterSearch, root } from "#test/routerApp.ts";
import type { NoteMissing } from "#test/routerClient.ts";

function missingNotice(error: NoteMissing) {
	return { message: `${error._tag}:${error.id}` };
}

export const noteFailures = { NoteMissing: missingNotice };

export const noteQuery = queryRoute(
	({ context, params, search }: { context: typeof root.types.allContext; params: { id: string }; search: typeof RouterSearch.Type }) =>
		context.client.api.get.query({ ...params, page: search.page * context.viewer.page }),
	{ failures: noteFailures },
);
