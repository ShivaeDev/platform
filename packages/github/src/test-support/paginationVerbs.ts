import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { FakeRepository } from "./fakeRepository.ts";

export function paginationVerbs({ server, state }: FakeRepository, tell: (line: string) => void) {
	return {
		changeNextPage: (page: number, next: number | undefined) =>
			Effect.sync(() => {
				tell(`GitHub revalidates page ${page} with ${next === undefined ? "no next page" : `page ${next} next`}`);
				state.pageReplies.set(page, {
					headers: next === undefined ? {} : { Link: `</repos/acme/widgets/pulls?page=${next}>; rel="next"` },
					status: HttpStatus.fromLiteral("NotModified"),
				});
			}),
		pageRevalidations: () =>
			Effect.sync(() =>
				server.requests
					.filter(({ path }) => path.split("?")[0] === "/repos/acme/widgets/pulls")
					.map(({ headers, query, status }) => ({ etag: headers["if-none-match"] ?? "no ETag", page: Number(query.get("page") ?? 1), status })),
			),
	};
}
