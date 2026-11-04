import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { domNavigate } from "@shivaedev/test-story/server/domNavigate.ts";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import type { socialEngine } from "./socialEngine.ts";

type SocialEngine = Effect.Success<ReturnType<typeof socialEngine>>;

export function socialSignInVerbs(engine: SocialEngine, story: Story<SocialEngine>) {
	const { baseUrl, client, fetch, provider } = engine;
	provider.server.narrate(story.tell);
	let callback = "";
	function start(providerId: string) {
		return Effect.promise(async () => {
			const result = await client.signIn.social({
				"callbackURL": `${baseUrl}/signed-in`,
				"errorCallbackURL": `${baseUrl}/refused`,
				provider: providerId,
			});
			if (result.error !== null) {
				throw new Error(`Social sign-in failed: ${JSON.stringify(result.error)}`);
			}
		});
	}
	return {
		aliceConsents: () =>
			Effect.promise(async () => {
				story.tell("Alice visits the provider and consents");
				const response = await fetch(window.location.href, { redirect: "manual" });
				callback = response.headers.get("location") ?? "";
				if (!callback) {
					throw new Error("Provider returned no callback");
				}
			}),
		aliceSignsInWithGitHub: () => {
			story.tell("Alice signs in with GitHub and the browser follows GitHub's redirect back");
			return Effect.andThen(
				start("github"),
				Effect.promise(() => domNavigate()),
			);
		},
		aliceSignsInWithOidc: () => {
			story.tell("Alice signs in through OIDC discovery and returns to the app");
			return Effect.andThen(
				start("oidc"),
				Effect.promise(() => domNavigate()),
			);
		},
		aliceStartsGitHubSignIn: () => {
			story.tell("Alice starts GitHub sign-in");
			return start("github");
		},
		codeLifetimePasses: () => {
			story.tell("the provider's one-minute code lifetime passes");
			return TestClock.adjust("1 minute");
		},
		refuseConsent: () => {
			story.tell("Alice refuses the provider's consent request");
			return provider.refuseConsent();
		},
		returnToApp: () => {
			story.tell("Alice returns to the app with the provider's callback");
			return Effect.promise(() => domNavigate(callback));
		},
		signInError: () => Effect.sync(() => new URL(window.location.href).searchParams.get("error")),
	};
}
