import { Effect } from "effect";
import { type Engine, person } from "./host.ts";

function adminRequest(engine: Engine, route: string, actor: string, body: Record<string, string>) {
	return Effect.promise(async () => {
		const response = await fetch(`${engine.baseUrl}/api/auth/admin/${route}`, {
			body: JSON.stringify(body),
			headers: { "content-type": "application/json", cookie: person(engine, actor).cookie, origin: engine.baseUrl },
			method: "POST",
		});
		const answer = await response.text();
		if (!response.ok) {
			throw new Error(`The admin request ${route} was refused: ${response.status} ${answer}`);
		}
	});
}

export function adminVerbs(engine: Engine, tell: (line: string) => void) {
	return {
		removesAccount: (admin: string, name: string) =>
			Effect.suspend(() => {
				tell(`${admin} removes ${name}'s account`);
				return adminRequest(engine, "remove-user", admin, { userId: person(engine, name).id });
			}),
		stepsDown: (name: string) =>
			Effect.suspend(() => {
				tell(`${name} steps down from admin to user`);
				return adminRequest(engine, "set-role", name, { role: "user", userId: person(engine, name).id });
			}),
	};
}
