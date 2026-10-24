import { Effect } from "effect";

export const authPost = Effect.fn("AppTest.authPost")(function* (baseUrl: string, path: string, body: object, cookie = "", origin = baseUrl) {
	const response = yield* Effect.promise(() =>
		fetch(`${baseUrl}/api/auth/${path}`, {
			body: JSON.stringify(body),
			headers: { "content-type": "application/json", cookie, origin },
			method: "POST",
		}),
	);
	yield* Effect.promise(() => response.text());
	const cookies = response.headers.getSetCookie();
	return { cookie: cookies.map((value) => value.split(";")[0]).join("; "), cookies, status: response.status };
});

export function credentials(name: string) {
	return { email: `${name}@app.test`, name, password: "correct-horse-battery-staple" };
}
