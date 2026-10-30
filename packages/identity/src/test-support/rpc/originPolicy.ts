import { Effect, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/http";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type TrustedOriginsOptions, trustedOrigins } from "#server/origin.ts";
import { resolveSession } from "#server/session.ts";

export const originPolicy = storyKit({
	create: (): { options: TrustedOriginsOptions } => ({ options: { allow: [], missing: "reject", sameOrigin: { trustedProxy: "10.0.0.2" } } }),
	name: "Session origin policy",
	stages: ["configured"],
	verbs: (state, story) => ({
		call: Effect.fnUntraced(function* (headers: Readonly<Record<string, string>>, peer?: string, message: Readonly<Record<string, string>> = {}) {
			story.tell(`a signed-in caller reaches session resolution from ${peer ?? "an unknown peer"} with ${JSON.stringify(headers)}`);
			const request = HttpServerRequest.fromWeb(new Request("http://internal.test/rpc", { headers })).modify({
				remoteAddress: Option.fromNullishOr(peer),
			});
			return yield* resolveSession(
				{ origin: trustedOrigins(state.options), provider: { get: () => Effect.succeed(Option.some({ user: { id: "alice" } })) } },
				Headers.fromInput(message),
				"Whoami",
			).pipe(
				Effect.provideService(HttpServerRequest.HttpServerRequest, request),
				Effect.as("accepted"),
				Effect.catchTag("Forbidden", () => Effect.succeed("Forbidden")),
			);
		}),
	}),
});

export function configuredOrigins(options: TrustedOriginsOptions) {
	return originPolicy.trait("configured", `the app configures ${JSON.stringify(options)}`, (state) => {
		state.options = options;
	});
}
