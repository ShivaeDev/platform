import { Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";

export function gitHub() {
	let person: "alice" | "bob" = "alice";
	const provider = fakeHttpService({
		routes: {
			authorize: {
				path: "/login/oauth/authorize",
				reply: ({ query }) => {
					const callback = new URL(query.get("redirect_uri") ?? "");
					callback.searchParams.set("state", query.get("state") ?? "");
					callback.searchParams.set("code", "story-code");
					return { headers: { location: callback.href }, status: HttpStatus.fromLiteral("Found") };
				},
			},
			emails: { path: "/user/emails", reply: () => ({ body: [{ email: `${person}@github.test`, primary: true, verified: true }] }) },
			token: {
				method: "POST",
				path: "/login/oauth/access_token",
				reply: () => ({ body: { "access_token": "story-token", scope: "read:user,user:email", "token_type": "bearer" } }),
			},
			user: {
				path: "/user",
				reply: () => ({
					body: { "avatar_url": null, email: `${person}@github.test`, id: person === "alice" ? 1001 : 1002, login: person, name: person },
				}),
			},
		},
	});
	return {
		provider,
		signingIn: (name: typeof person) => {
			person = name;
		},
	};
}

const Redirect = Schema.Struct({ url: Schema.String });

export async function gitHubSignIn(baseUrl: string) {
	const start = await fetch(`${baseUrl}/api/auth/sign-in/social`, {
		body: JSON.stringify({ "callbackURL": `${baseUrl}/signed-in`, "errorCallbackURL": `${baseUrl}/refused`, provider: "github" }),
		headers: { "content-type": "application/json", origin: baseUrl },
		method: "POST",
	});
	const { url } = Schema.decodeUnknownSync(Redirect)(await start.json());
	const authorize = await fetch(url, { redirect: "manual" });
	const callback = await fetch(authorize.headers.get("location") ?? "", {
		headers: { cookie: cookiesOf(start) },
		redirect: "manual",
	});
	const location = new URL(callback.headers.get("location") ?? "", baseUrl);
	return { cookie: cookiesOf(callback), error: location.searchParams.get("error"), signedIn: location.pathname === "/signed-in" };
}

function cookiesOf(response: Response) {
	return response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
}
