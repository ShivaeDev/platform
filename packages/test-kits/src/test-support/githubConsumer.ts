import { DateTime, Effect, Layer, Redacted, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import { GitHubConfig } from "@shivaedev/github/GitHubConfig.ts";
import { githubApp } from "@shivaedev/github/githubApp.ts";
import { graphql } from "@shivaedev/github/graphql.ts";
import { read } from "@shivaedev/github/read.ts";
import { verifyWebhook } from "@shivaedev/github/verifyWebhook.ts";
import { write } from "@shivaedev/github/write.ts";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { fakeGitHubApp } from "#github/fake.ts";

const Title = Schema.Struct({ title: Schema.String });
const Comment = Schema.Struct({ body: Schema.String, id: Schema.Number });
const Repository = Schema.Struct({ repository: Schema.Struct({ name: Schema.String }) });
const Delivery = Schema.Struct({ action: Schema.String, issue: Schema.Struct({ number: Schema.Number }) });
export const QUERY = 'query Repository($owner: String!) { repository(owner: $owner, name: "widgets") { name } }';

export const githubConsumer = storyKit({
	*create() {
		const provider = yield* fakeGitHubApp({
			routes: ({ installationToken }) => ({
				comment: {
					guard: installationToken,
					method: "POST",
					path: "/repos/acme/widgets/issues/3/comments",
					reply: ({ body }) => ({
						body: { ...Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ body: Schema.String })))(body.toString()), id: 9 },
						status: 201,
					}),
				},
				graphql: {
					guard: installationToken,
					method: "POST",
					path: "/graphql",
					reply: () => ({ body: { data: { repository: { name: "widgets" } } } }),
				},
				issue: { guard: installationToken, path: "/repos/acme/widgets/issues/3", reply: () => ({ body: { title: "Ship widgets" } }) },
			}),
		});
		const context = yield* Layer.build(
			GitHub.layer.pipe(
				Layer.provide(
					githubApp({ appId: provider.credentials.appId, installationId: 7, privateKey: Redacted.make(provider.credentials.privateKey) }),
				),
				Layer.provide(Layer.mergeAll(FetchHttpClient.layer, Layer.succeed(GitHubConfig)({ apiUrl: provider.server.url }))),
			),
		);
		const receiver = yield* fakeHttpService({ routes: { delivery: { method: "POST", path: "/hooks/github", reply: () => ({ status: 202 }) } } });
		return { context, provider, receiver };
	},
	inspect: ({ provider, receiver }) => ({
		github: provider.server.requests.map(({ method, path, status }) => ({ method, path, status })),
		webhooks: receiver.requests.map(({ method, path, status }) => ({ method, path, status })),
	}),
	name: "application GitHub integration",
	stages: ["github"],
	verbs: ({ provider, context, receiver }, story) => {
		provider.server.narrate(story.tell);
		receiver.narrate(story.tell);
		return {
			deliverIssue: (number: number) => {
				story.tell("GitHub delivers a signed issue event over HTTP");
				return provider.deliverWebhook(`${receiver.url}/hooks/github`, {
					body: Buffer.from(JSON.stringify({ action: "opened", issue: { number } })),
					deliveryId: "issue-delivery",
					event: "issues",
				});
			},
			postComment: (body: string) => {
				story.tell("the application posts its response on issue 3");
				return write("POST", "/repos/acme/widgets/issues/3/comments", { body }, Comment).pipe(Effect.provide(context));
			},
			rateLimited: () =>
				provider.server.scriptFault("issue", {
					kind: "status",
					reply: { body: { message: "You have exceeded a secondary rate limit" }, headers: { "retry-after": "30" }, status: 429 },
				}),
			readIssue: () => {
				story.tell("the application reads issue 3 using its installation");
				return read("/repos/acme/widgets/issues/3", Title).pipe(Effect.provide(context));
			},
			readLimitedIssue: () =>
				read("/repos/acme/widgets/issues/3", Title).pipe(
					Effect.provide(context),
					Effect.catchTag("GitHubRateLimited", (failure) =>
						Effect.succeed(`rate limited on ${failure.resource} until ${DateTime.formatIso(failure.retryAt)}`),
					),
				),
			readRepository: () => {
				story.tell("the application queries the installed repository");
				return graphql(QUERY, { owner: "acme" }, Repository).pipe(Effect.provide(context));
			},
			requests: () =>
				Effect.sync(() =>
					provider.server.requests.map(({ method, path, body, headers }) => ({
						authorization: headers.authorization,
						body: body.toString(),
						method,
						path,
					})),
				),
			verifiedDelivery: () =>
				Effect.gen(function* () {
					const request = receiver.requests[0];
					if (request === undefined) {
						return yield* Effect.die("No webhook delivery arrived");
					}
					const payload = yield* verifyWebhook(
						request.body,
						request.headers["x-hub-signature-256"]?.toString(),
						Redacted.make(provider.credentials.webhookSecret),
						Delivery,
					);
					return {
						contentType: request.headers["content-type"],
						deliveryId: request.headers["x-github-delivery"],
						event: request.headers["x-github-event"],
						payload,
					};
				}),
		};
	},
});
