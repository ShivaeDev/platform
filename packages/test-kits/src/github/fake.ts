import { Effect } from "effect";
import { type FakeHttpRequest, type FakeHttpRoute, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { appProvider } from "#github/adapters/appProvider.ts";
import { githubAppCredentials } from "#github/adapters/credentials.ts";
import { webhookDelivery } from "#github/webhookDelivery.ts";

export interface GitHubAppAccess {
	readonly appRequest: (request: FakeHttpRequest) => boolean;
	readonly installationOf: (request: FakeHttpRequest) => number | undefined;
	readonly installationToken: (request: FakeHttpRequest) => boolean;
}

export const fakeGitHubApp = Effect.fnUntraced(function* (
	options: {
		readonly credentials?: ReturnType<typeof githubAppCredentials>;
		readonly prefix?: string;
		readonly routes?: (access: GitHubAppAccess) => Readonly<Record<string, FakeHttpRoute>>;
	} = {},
) {
	const credentials = options.credentials ?? githubAppCredentials();
	const prefix = options.prefix ?? "";
	const { access, state, token } = yield* appProvider(credentials, prefix);
	const server = yield* fakeHttpService({
		routes: {
			token,
			...options.routes?.(access),
		},
	});
	return { credentials, deliverWebhook: webhookDelivery(credentials.webhookSignature), server, state };
});
