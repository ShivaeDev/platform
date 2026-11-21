import { DateTime, Effect } from "effect";
import { storyAuth } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppAuth } from "#server/AppAuth.ts";
import { appScreen } from "#test-support/appScreen.tsx";
import { configured, postgres } from "#test-support/postgres.ts";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";

export const ALICE_PASSWORD = "alice-starter-password";
// A precomputed hash of alice's password keeps the check real without hashing in each story's setup.
const ALICE_PASSWORD_HASH =
	"764b9f494e033e8d4d54e8e197b2e54d:1ff15e0dc579302c26a390989c24e7c2ee08d53df292333363621d45c39db9606f441b1c14f871537374fcd9365eaa316c7aebe5f3829c743f4fb5fddf38d751";

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
