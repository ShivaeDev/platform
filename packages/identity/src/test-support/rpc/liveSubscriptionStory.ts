import { Effect, Queue } from "effect";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { assignRole } from "#server/better-auth/assignRole.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { documents, liveSubscriptionEngine } from "./liveSubscriptionEngine.ts";
import { DocumentRoles } from "./liveSubscriptionProvider.ts";
import { databaseUrl, postgres } from "./postgres.ts";
import { revalidationClock } from "./revalidationClock.ts";
import { expireSession, signOut } from "./sessionLifecycle.ts";

export function subscriptionStory(delivery: "hints" | "pushed") {
	return storyKit({
		around: withIdentityDatabase,
		clock: storyClock,
		create: () => liveSubscriptionEngine(delivery),
		layer: postgres,
		name: `live subscription session (${delivery})`,
		runIf: databaseUrl !== undefined,
		stages: [],
		verbs: (engine, story) => ({
			aliceSessionExpires: () => {
				story.tell("alice's stored session expires");
				return expireSession(engine.provider, engine.session.session.token);
			},
			aliceSessionIsRevoked: () => {
				story.tell("alice revokes her session through Better Auth");
				return Effect.promise(() =>
					engine.provider.auth.api.revokeSession({ body: { token: engine.session.session.token }, headers: engine.session.headers }),
				);
			},
			aliceSignsOut: () => {
				story.tell("alice signs out through Better Auth");
				return signOut(engine.provider, { cookie: engine.cookie });
			},
			denyAliceRead: () => {
				story.tell("the document policy stops allowing alice to read");
				return Effect.sync(() => {
					engine.state.readable = false;
				});
			},
			grantAliceRead: (role: "reader" | "editor" = "reader") => {
				story.tell(`alice is assigned the ${role} role`);
				return assignRole(DocumentRoles, engine.session.user.id, role);
			},

			nextHint: () =>
				Effect.raceFirst(
					Queue.take(engine.hints),
					Effect.flatMap(engine.ending, (ending) => Effect.die(`Subscription ended: ${ending}`)),
				),
			publish: () => {
				story.tell("the server announces a document change");
				return engine.reactivity.invalidate(invalidationKeys([documents.item("alice")]));
			},
			...revalidationClock(() => "5 seconds", engine.checked, story.tell),
			revokeAliceRole: () => {
				story.tell("alice is assigned the guest role without document access");
				return assignRole(DocumentRoles, engine.session.user.id, "guest");
			},
			sessionStoreBecomesUnavailable: () => {
				story.tell("the session store becomes unavailable");
				return Effect.sync(() => {
					engine.state.unavailable = true;
				});
			},
			subscriptionEnding: () => engine.ending,
		}),
	});
}

export const liveSubscriptionStory = subscriptionStory("hints");
export const pushedSubscriptionStory = subscriptionStory("pushed");
