import { Effect, Predicate } from "effect";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import type { AppAccess } from "#AppAccess.ts";
import { appScreen } from "#modules/notes/test-support/appScreen.tsx";
import type { AdminScreen } from "./screens.tsx";

const warnings = expectNoReactWarnings();

export const openScreen = Effect.fn("AdminScreen.openScreen")(function* (engine: AdminScreen, route: string, role: typeof AppAccess.Role.Type) {
	const screen = yield* appScreen({
		account: { name: "alice", role },
		host: engine.host,
		renderOptions: role === "user" ? { onCaughtError: warnings.expectCaughtError((error) => Predicate.isTagged(error, "Forbidden")) } : {},
		route,
	});
	engine.accounts.set("alice", screen.account);
	Object.assign(engine, screen);
});
