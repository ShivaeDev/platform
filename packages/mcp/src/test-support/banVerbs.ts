import { Clock, Effect } from "effect";
import { type Engine, person } from "./host.ts";

const PASSWORD = "correct-horse-battery-staple";

export function banVerbs(engine: Engine, tell: (line: string) => void) {
	return {
		setsBan: (name: string, kind: "expired" | "active" | "permanent") =>
			Effect.gen(function* () {
				tell(`${name} has a ban that is ${kind}`);
				const now = yield* Clock.currentTimeMillis;
				const banExpires = kind === "permanent" ? null : new Date(now + (kind === "expired" ? -3_600_000 : 3_600_000));
				const { internalAdapter } = yield* Effect.promise(() => engine.auth.$context);
				yield* Effect.promise(() => internalAdapter.updateUser(person(engine, name).id, { banExpires, banned: true }));
			}),
		signsInOnWeb: (name: string) =>
			Effect.promise(async () => {
				tell(`${name} signs in with a password through the web route`);
				const response = await fetch(`${engine.baseUrl}/api/auth/sign-in/email`, {
					body: JSON.stringify({ email: `${name}@mcp.test`, password: PASSWORD }),
					headers: { "content-type": "application/json", origin: engine.baseUrl },
					method: "POST",
				});
				const body = await response.json();
				if (!response.ok) {
					return `${response.status} ${body.code}`;
				}
				const cookie = response.headers
					.getSetCookie()
					.map((value) => value.split(";")[0])
					.join("; ");
				engine.people.set(name, { cookie, id: person(engine, name).id });
				return "signed in";
			}),
	};
}
