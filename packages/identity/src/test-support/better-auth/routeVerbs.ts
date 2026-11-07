import { Effect } from "effect";
import { NATIVE_ORIGIN, PASSWORD, type RouteState } from "#test/better-auth/routeHost.ts";

function sessionHeaders(response: Response) {
	const token = response.headers.get("set-auth-token");
	if (token !== null) {
		return new Headers({ authorization: `Bearer ${token}`, origin: NATIVE_ORIGIN });
	}
	const cookie = response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
	return new Headers({ cookie });
}

export function routeVerbs(state: RouteState, story: { readonly tell: (line: string) => void }) {
	const host = state.host;
	if (host === undefined) {
		throw new Error("Auth routes have not started");
	}
	function credential(name: string) {
		const headers = state.credentials.get(name);
		if (headers === undefined) {
			throw new Error(`No credential named ${name}`);
		}
		return headers;
	}
	return {
		emailedUrl: () => Effect.sync(() => host.mailbox.at(-1)),
		followEmail: () =>
			Effect.promise(async () => {
				story.tell("alice opens her verification email link");
				const url = host.mailbox.at(-1);
				if (url === undefined) {
					throw new Error("No verification email reached alice");
				}
				const response = await fetch(url, { redirect: "manual" });
				await response.text();
				return { location: response.headers.get("location"), status: response.status };
			}),
		requestEmail: (path: string) =>
			Effect.promise(async () => {
				story.tell("alice requests a verification email");
				const response = await fetch(`${host.url}${path}/send-verification-email`, {
					body: JSON.stringify({ "callbackURL": "/verified", email: "alice@example.test" }),
					headers: { "content-type": "application/json", origin: host.url },
					method: "POST",
				});
				await response.text();
				return response.status;
			}),
		session: (path: string, name: string) =>
			Effect.promise(async () => {
				story.tell(`${name} reads the session under ${path || "/"}`);
				const response = await fetch(`${host.url}${path}/get-session`, { headers: credential(name) });
				return { body: await response.json(), status: response.status };
			}),
		signIn: (path: string, name: string, previous?: string) =>
			Effect.promise(async () => {
				story.tell(`alice signs in under ${path || "/"}${previous === undefined ? "" : " with her previous bearer"}`);
				const headers = new Headers(previous === undefined ? undefined : credential(previous));
				headers.set("content-type", "application/json");
				headers.set("origin", previous === undefined ? host.url : NATIVE_ORIGIN);
				const response = await fetch(`${host.url}${path}/sign-in/email`, {
					body: JSON.stringify({ email: "alice@example.test", password: PASSWORD }),
					headers,
					method: "POST",
				});
				await response.text();
				state.credentials.set(name, sessionHeaders(response));
				return response.status;
			}),
	};
}
