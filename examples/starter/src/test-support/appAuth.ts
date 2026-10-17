import { makeAuth } from "#client/auth.ts";

export function appAuth(options: {
	readonly baseUrl: string;
	readonly signedIn?: boolean;
	readonly sessionFailure?: boolean;
	readonly signOutFailure?: string;
}) {
	let sessionFailure = options.sessionFailure ?? false;
	const requests: URL[] = [];
	const date = "2026-01-01T00:00:00.000Z";
	const session = options.signedIn
		? {
				session: {
					createdAt: date,
					expiresAt: "2099-01-01T00:00:00.000Z",
					id: "alice-session",
					updatedAt: date,
					userId: "alice",
				},
				user: { createdAt: date, email: "alice@app.test", emailVerified: true, id: "alice", name: "Alice", updatedAt: date },
			}
		: null;
	const auth = makeAuth({
		baseUrl: options.baseUrl,
		fetchOptions: {
			customFetchImpl: (input, init) => {
				const request = new Request(input, init);
				const url = new URL(request.url);
				requests.push(url);
				if (url.pathname === "/api/auth/get-session") {
					return Promise.resolve(
						Response.json(sessionFailure ? { code: "UNAVAILABLE", message: "Session check unavailable" } : session, {
							status: sessionFailure ? 500 : 200,
						}),
					);
				}
				if (url.pathname === "/api/auth/sign-out") {
					return Promise.resolve(Response.json({ code: "REFUSED", message: options.signOutFailure }, { status: 400 }));
				}
				return Promise.reject(new Error(`Unexpected auth request: ${url}`));
			},
			retry: 0,
		},
	});
	return {
		auth,
		recover: () => {
			sessionFailure = false;
		},
		requests,
	};
}
