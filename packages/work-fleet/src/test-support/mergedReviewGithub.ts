import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import { GithubApi } from "#host/githubApi.ts";
import { makeGithubChecks } from "#host/githubChecks.ts";
import { githubCiHold } from "#host/githubCiHold.ts";
import { githubDelivery, readPullRequest } from "#host/githubDelivery.ts";
import { githubPublication } from "#host/githubPublication.ts";
import { githubResult } from "#host/githubResult.ts";
import { httpGithubApi } from "#test/githubApi.ts";
import { BASE, HEAD, resultFixture } from "#test/githubResult.ts";
import { type GithubState, githubFilePage, githubResponses } from "#test/mergedReviewResponses.ts";

export const mergedReviewGithub = Effect.fn("Test.mergedReviewGithub")(function* (boardDir?: string) {
	const state: GithubState = {
		base: BASE,
		failed: false,
		head: HEAD,
		legacyResult: false,
		mergeable: "MERGEABLE",
		paths: ["src/one.ts"],
		pending: false,
		status: "OPEN",
		unavailableReads: 0,
	};
	const requests: string[] = [];
	const mutations: { readonly method: string; readonly path: string }[] = [];
	const conditionalHits: string[] = [];
	const server = createServer((request, response) => {
		const path = request.url ?? "";
		requests.push(path);
		if (request.method !== undefined && request.method !== "GET") {
			mutations.push({ method: request.method, path });
		}
		if (state.unavailableReads > 0) {
			state.unavailableReads -= 1;
			response.writeHead(HttpStatus.fromLiteral("ServiceUnavailable")).end();
			return;
		}
		const page = githubFilePage(state, path);
		const body = page?.body ?? githubResponses(state)[path];
		if (page?.next !== undefined) {
			response.setHeader("Link", `<http://${request.headers.host}${page.next}>; rel="next"`);
		}
		const json = JSON.stringify(body);
		const etag = `"${createHash("sha256")
			.update(json ?? "")
			.digest("hex")}"`;
		response.setHeader("ETag", etag);
		if (body !== undefined && request.headers["if-none-match"] === etag) {
			conditionalHits.push(path);
			response.removeHeader("Link");
			response.writeHead(HttpStatus.fromLiteral("NotModified")).end();
			return;
		}
		response.setHeader("Content-Type", "application/json");
		response.writeHead(body === undefined ? HttpStatus.fromLiteral("NotFound") : HttpStatus.fromLiteral("OK")).end(json);
	});
	yield* Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)));
	yield* Effect.addFinalizer(() => Effect.promise(() => new Promise<void>((resolve) => server.close(() => resolve()))));
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die(new Error("No synthetic GitHub server address"));
	}
	const origin = `http://127.0.0.1:${address.port}`;
	const api = yield* httpGithubApi(origin);
	const { host } = resultFixture();
	const github = { get: api.get, pages: api.get };
	const adopt = githubResult({ ...host, boardDir: boardDir ?? host.boardDir }, api, Effect.succeed("example/repository"));
	return {
		checksQuery: makeGithubChecks(github.pages),
		conditionalHits,
		deliveryQuery: githubDelivery(readPullRequest(github.get)),
		mutations,
		observeCiPaths: (result: Parameters<typeof githubCiHold>[0], approvedHead?: string) =>
			githubCiHold(result, approvedHead).pipe(Effect.provideService(GithubApi, api)),
		publication: githubPublication(
			{ ...host, worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" } },
			github,
			Effect.succeed("example/repository"),
		),
		requests,
		resultQuery: (...args: Parameters<typeof adopt>) =>
			adopt(...args).pipe(
				Effect.flatMap((result) =>
					state.legacyResult && state.status === "MERGED"
						? Effect.fail(new BadRequest({ message: "Reported PR must be open and target the configured repository branch" }))
						: Effect.succeed(result),
				),
			),
		state,
	};
});
