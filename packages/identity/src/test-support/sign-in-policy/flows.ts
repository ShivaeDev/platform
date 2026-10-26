import { Schema } from "effect";

const SocialSignIn = Schema.Struct({ url: Schema.String });
const SignUpRefusal = Schema.Struct({ code: Schema.optional(Schema.String) });

function cookiesOf(response: Response) {
	return response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0] ?? "")
		.filter((pair) => !pair.endsWith("="))
		.join("; ");
}

export async function gitHubSignIn(baseUrl: string, accountId: string) {
	const start = await fetch(`${baseUrl}/api/auth/sign-in/social`, {
		body: JSON.stringify({ "callbackURL": `${baseUrl}/signed-in`, "errorCallbackURL": `${baseUrl}/refused`, provider: "github" }),
		headers: { "content-type": "application/json", origin: baseUrl },
		method: "POST",
	});
	const { url } = Schema.decodeUnknownSync(SocialSignIn)(await start.json());
	const authorize = await fetch(url, { headers: { "x-github-account": accountId }, redirect: "manual" });
	const callback = await fetch(authorize.headers.get("location") ?? "", { headers: { cookie: cookiesOf(start) }, redirect: "manual" });
	const location = new URL(callback.headers.get("location") ?? "", baseUrl);
	const cookie = cookiesOf(callback);
	return location.pathname === "/signed-in" && cookie.length > 0
		? ({ cookie, signedIn: true } as const)
		: ({ error: location.searchParams.get("error"), signedIn: false } as const);
}

export async function emailSignUp(baseUrl: string, email: string) {
	const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
		body: JSON.stringify({ email, name: email, password: "story-password-123" }),
		headers: { "content-type": "application/json", origin: baseUrl },
		method: "POST",
	});
	return { code: Schema.decodeUnknownSync(SignUpRefusal)(await response.json()).code, status: response.status };
}
