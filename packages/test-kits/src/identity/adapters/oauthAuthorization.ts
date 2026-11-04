import { randomUUID } from "node:crypto";
import type { FakeHttpReply, FakeHttpRequest } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { OauthProfile } from "#identity/oauth.ts";

export interface OauthCode {
	readonly expires: number;
	readonly profile: OauthProfile;
	readonly query: URLSearchParams;
}

export interface OauthProtocolOptions {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly codeLifetime: number;
	readonly now: () => number;
	readonly profile: OauthProfile | ((request: FakeHttpRequest) => OauthProfile);
}

export function oauthAuthorization(options: OauthProtocolOptions) {
	const codes = new Map<string, OauthCode>();
	let consent = true;
	return {
		authorize: (request: FakeHttpRequest): FakeHttpReply => {
			const { query } = request;
			if (query.get("client_id") !== options.clientId) {
				return { body: { error: "invalid_client" }, status: 400 };
			}
			if (query.get("response_type") !== "code") {
				return { body: { error: "unsupported_response_type" }, status: 400 };
			}
			const callback = new URL(query.get("redirect_uri") ?? "");
			const state = query.get("state");
			if (state !== null) {
				callback.searchParams.set("state", state);
			}
			if (consent) {
				const value = randomUUID();
				codes.set(value, {
					expires: options.now() + options.codeLifetime,
					profile: typeof options.profile === "function" ? options.profile(request) : options.profile,
					query,
				});
				callback.searchParams.set("code", value);
			} else {
				callback.searchParams.set("error", "access_denied");
			}
			return { headers: { location: callback.href }, status: 302 };
		},
		codes,
		consent: (allowed: boolean) => {
			consent = allowed;
		},
	};
}
