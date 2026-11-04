import { Effect, Option } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { trustedOrigins } from "#server/adapters/trustedOrigins.ts";
import type { OriginPolicy } from "#server/origin.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { makeApp } from "./api.ts";
import { createProvider, mintSession, ORIGIN } from "./harness.ts";
import { databaseUrl, postgres } from "./postgres.ts";
import { type Engine, type OriginName, origins, type Person, transportHeaders } from "./sessionModel.ts";
import { sessionVerbs } from "./sessionVerbs.ts";

const browser = trustedOrigins({ allow: [ORIGIN, origins["the Capacitor shell"]], missing: "reject" });

export const sessions = storyKit({
	after: {
		policy(engine) {
			if (engine.origin !== undefined) {
				engine.app = makeApp(engine.provider, engine.origin);
			}
		},
	},
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		const provider = yield* createProvider();
		const engine: Engine = { accounts: new Map(), close: provider.close, provider };
		yield* Effect.addFinalizer(() => Effect.promise(async () => engine.app?.app.dispose()));
		return engine;
	},
	inspect: (engine) => ({ accounts: [...engine.accounts.keys()], lookups: engine.provider.lookups() }),
	layer: postgres,
	name: "RPC session",
	runIf: databaseUrl !== undefined,
	stages: ["policy", "accounts", "upgrade"],
	verbs: (engine, story) => sessionVerbs(engine, story.tell),
});

function policy(line: string, origin: OriginPolicy) {
	return sessions.trait("policy", line, (engine) => {
		engine.origin = origin;
	});
}

export const browserOrigins = policy("RPC trusts the app and the Capacitor shell, and refuses calls without an origin", browser);

export const appOrMissingOrigin = policy("RPC trusts the app and calls without an origin", trustedOrigins({ allow: [ORIGIN], missing: "allow" }));

export const greetingsWithoutOrigin = policy("RPC trusts the app, and lets only greetings arrive without an origin", (request) =>
	Option.match(request.origin, { onNone: () => request.rpc === "Greeting", onSome: (value) => value === ORIGIN }),
);

export function mintedSessions(...people: Person[]) {
	return sessions.trait("accounts", `${people.join(" and ")} start with minted sessions`, function* (engine) {
		for (const person of people) {
			engine.accounts.set(person, yield* mintSession(engine.provider, person));
		}
	});
}

export function webSocketOpened(caller: Person | "anonymous", from: OriginName) {
	return sessions.trait("upgrade", `${caller === "anonymous" ? "an anonymous caller" : caller} opens the RPC WebSocket from ${from}`, (engine) => {
		engine.upgrade = transportHeaders(engine, caller, { from });
	});
}
