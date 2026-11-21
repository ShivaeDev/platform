import { Effect, type Layer } from "effect";
import { SessionCredential } from "#client/SessionCredential.ts";

// Structural copies of the Better Auth client plugin shapes: the client core must not reach the optional better-auth peer.
interface CredentialRequest {
	credentials?: RequestCredentials | undefined;
	readonly headers: Headers;
	readonly url: URL | string;
}

interface CredentialAnswer {
	readonly data: unknown;
	readonly request: CredentialRequest;
	readonly response: Response;
}

interface CredentialFetchPlugin {
	readonly hooks: {
		readonly onRequest: (context: CredentialRequest) => Promise<void>;
		readonly onSuccess: (context: CredentialAnswer) => Promise<void>;
	};
	readonly id: string;
	readonly name: string;
}

export interface SessionCredentialPlugin {
	readonly fetchPlugins: CredentialFetchPlugin[];
	readonly id: "session-credential";
}

function bearerOf(credential: string | null) {
	return credential === null ? null : `Bearer ${credential}`;
}

const send = Effect.fnUntraced(function* (request: CredentialRequest) {
	const credential = yield* SessionCredential;
	const authorization = bearerOf(yield* credential.read);
	if (authorization !== null) {
		request.headers.set("authorization", authorization);
	}
	request.credentials = "omit";
});

// An answer changes the stored credential only when its request carried the one stored now, so a session check sent
// before sign-in that answers signed out after it cannot wipe the credential sign-in saved.
const settle = Effect.fnUntraced(function* ({ data, request, response }: CredentialAnswer) {
	const credential = yield* SessionCredential;
	if (bearerOf(yield* credential.read) !== request.headers.get("authorization")) {
		return;
	}
	const path = new URL(request.url, "http://localhost").pathname;
	const issued = response.headers.get("set-auth-token");
	if (path.endsWith("/sign-out") || (path.endsWith("/get-session") && data === null)) {
		return yield* credential.clear;
	}
	if (issued !== null) {
		yield* credential.write(issued);
	}
});

export function sessionCredentialPlugin(credential: Layer.Layer<SessionCredential>): SessionCredentialPlugin {
	return {
		fetchPlugins: [
			{
				hooks: {
					onRequest: (request) => Effect.runPromise(Effect.provide(send(request), credential)),
					onSuccess: (answer) => Effect.runPromise(Effect.provide(settle(answer), credential)),
				},
				id: "session-credential",
				name: "session credential",
			},
		],
		id: "session-credential",
	};
}
