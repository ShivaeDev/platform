import { DateTime, Effect } from "effect";
import { storyAuth } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppAuth } from "#server/AppAuth.ts";
import { appScreen } from "#test-support/appScreen.tsx";
import { configured, postgres } from "#test-support/postgres.ts";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";

export const ALICE_PASSWORD = "alice-account-password";
// A precomputed hash of alice's password keeps the check real without hashing in each story's setup.
const ALICE_PASSWORD_HASH =
	"b8fed1eda938eae61920f282ee3ca4b2:f8b318084670970f9fa3b3be313ac557de80a4cfc6592ff4b498eef7ef2d5b0cdad944a5599824f2cb11d44c3c319d6680cec904698434bb6bea123692b8a620";

export const accountScreen = Effect.fn("AccountStory.accountScreen")(function* () {
	const screen = yield* appScreen({ account: { name: "alice" }, route: "/account" });
	const auth = yield* storyAuth(AppAuth, screen);
	const context = yield* Effect.promise(() => auth.$context);
	yield* Effect.promise(() =>
		context.internalAdapter.createAccount({
			accountId: screen.account.user.id,
			password: ALICE_PASSWORD_HASH,
			providerId: "credential",
			userId: screen.account.user.id,
		}),
	);
	return screen;
});

export function accountVerbs(
	engine: ScreenSurface & { readonly history: { readonly location: { readonly pathname: string } } },
	tell: (line: string) => void,
) {
	return {
		...uiScreenVerbs(engine, tell),
		dialogAlert: () =>
			Effect.sync(() => screenView(engine).container.ownerDocument.querySelector("[role=dialog] [role=alert]")?.textContent ?? "no alert"),
		href: () => Effect.sync(() => engine.history.location.pathname),
	};
}

export const accountDeletion = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	create: accountScreen,
	inspect: ({ history, view }) => ({ route: history.location.pathname, text: view.container.ownerDocument.body.textContent }),
	layer: postgres,
	name: "account deletion",
	runIf: configured,
	stages: [],
	verbs: (engine, story) => accountVerbs(engine, story.tell),
});
