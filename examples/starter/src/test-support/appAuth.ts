import * as HttpStatus from "effect/http/HttpStatus";
import { makeAuth } from "#client/auth.ts";

export function appAuth(options: {
	readonly baseUrl: string;
	readonly signedIn?: boolean;
	readonly sessionFailure?: boolean;
	readonly signOutFailure?: string;
	readonly onSessionChange?: (signedIn: boolean) => void;
}) {
	let sessionFailure = options.sessionFailure ?? false;
	const requests: URL[] = [];
	const date = "2026-01-01T00:00:00.000Z";
	const signedInSession = {
		session: {
			createdAt: date,
			expiresAt: "2099-01-01T00:00:00.000Z",
			id: "alice-session",
			updatedAt: date,
			userId: "alice",
		},
		user: {
			createdAt: date,
			email: "alice@app.test",
			emailVerified: true,
			id: "alice",
			name: "Alice",
			permissions: [{ name: "resume", strength: "own" }],
			updatedAt: date,
		},
	};
	let session = options.signedIn ? signedInSession : null;
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
							status: sessionFailure ? HttpStatus.fromLiteral("InternalServerError") : HttpStatus.fromLiteral("OK"),
						}),
					);
				}
				if (url.pathname === "/api/auth/sign-in/email") {
					session = signedInSession;
					options.onSessionChange?.(true);
					return Promise.resolve(Response.json({ token: "session-token", user: signedInSession.user }));
				}
				if (url.pathname === "/api/auth/sign-out") {
					if (options.signOutFailure === undefined) {
						session = null;
						options.onSessionChange?.(false);
						return Promise.resolve(Response.json({ success: true }));
					}
					return Promise.resolve(
						Response.json({ code: "REFUSED", message: options.signOutFailure }, { status: HttpStatus.fromLiteral("BadRequest") }),
					);
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
