import { Effect } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { afterEach, expect, vi } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import * as reading from "#server/http/readPage.ts";
import { responseWorkspace } from "#test/responseEdges.ts";

afterEach(() => vi.restoreAllMocks());

it.live.each([HttpServerResponse.text("Unavailable", { status: 503 }), HttpServerResponse.empty()])(
	"keeps the page rejection and recovery message across HTTP RPC",
	function* (response) {
		vi.spyOn(reading, "readPage").mockImplementation(() => () => Effect.succeed(response));
		const { client } = yield* responseWorkspace();
		const failure = yield* Effect.promise(() => client.run(client.api.page.run({ url: "/proposal.md" })).catch((error: unknown) => error));
		expect(failure).toBeInstanceOf(InternalServerError);
		expect(failure).toMatchObject({
			message: `Page response is unreadable (status ${response.status}, body ${response.body._tag}). Retry the page; if it still fails, restart Work Board.`,
		});
	},
);
