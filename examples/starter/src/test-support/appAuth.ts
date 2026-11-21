import * as HttpStatus from "effect/http/HttpStatus";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { SessionRuntime } from "@shivaedev/react/client/authSession.ts";
import { makeAuth } from "#client/adapters/auth.ts";
import { sessionRequests } from "#test-support/sessionRequests.ts";

export function appAuth(options: {
	readonly baseUrl: string;
	readonly signedIn?: boolean;
	readonly sessionFailure?: boolean;
	readonly sessionHeld?: boolean;
	readonly malformedSession?: boolean;
	readonly signOutFailure?: string;
	readonly onSessionChange?: (signedIn: boolean) => void;
	readonly runtime?: SessionRuntime;
}) {
	let sessionFailure = options.sessionFailure ?? false;
	const requests: URL[] = [];
	const heldChecks: (() => void)[] = [];
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
			permissions: [],
			updatedAt: date,
		},
	};
	const initialSession = options.malformedSession
		? { ...signedInSession, user: { ...signedInSession.user, permissions: "invalid" } }
		: signedInSession;
	let session = options.signedIn ? initialSession : null;
	const checks = sessionRequests((input, init) => {
		const request = new Request(input, init);
		const url = new URL(request.url);
		requests.push(url);
		if (url.pathname === "/api/auth/get-session") {
			function answer() {
				return Response.json(sessionFailure ? { code: "UNAVAILABLE", message: "Session check unavailable" } : session, {
					status: sessionFailure ? HttpStatus.fromLiteral("InternalServerError") : HttpStatus.fromLiteral("OK"),
				});
			}
			return options.sessionHeld ? new Promise((resolve) => heldChecks.push(() => resolve(answer()))) : Promise.resolve(answer());
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
			return Promise.resolve(Response.json({ code: "REFUSED", message: options.signOutFailure }, { status: HttpStatus.fromLiteral("BadRequest") }));
		}
		return Promise.reject(new Error(`Unexpected auth request: ${url}`));
	});
	const auth = makeAuth({ baseUrl: options.baseUrl, fetchOptions: { customFetchImpl: checks.fetch, retry: 0 }, runtime: options.runtime });
	return {
		auth,
		fail: () => {
			sessionFailure = true;
		},
		recover: () => {
			sessionFailure = false;
		},
		releaseSessionCheck: () => {
			for (const release of heldChecks.splice(0)) {
				release();
			}
		},
		requests,
		sessionPending: (registry: AtomRegistry.AtomRegistry) => checks.pending(registry, auth.session.atom),
	};
}
