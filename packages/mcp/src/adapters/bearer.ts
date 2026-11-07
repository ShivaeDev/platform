import { isAPIError } from "better-auth/api";
import { verifyJwsAccessToken } from "better-auth/oauth2";
import { Effect, Option } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { InvalidTokenClaim } from "#adapters/InvalidTokenClaim.ts";

export type JwksSource = Parameters<typeof verifyJwsAccessToken>[1]["jwksFetch"];

const INVALID_TOKEN_ERRORS = new Set([
	"ERR_JWT_EXPIRED",
	"ERR_JWT_CLAIM_VALIDATION_FAILED",
	"ERR_JWT_INVALID",
	"ERR_JWS_INVALID",
	"ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
	"ERR_JWKS_NO_MATCHING_KEY",
	"ERR_JOSE_ALG_NOT_ALLOWED",
	"ERR_JOSE_NOT_SUPPORTED",
]);

function bearerFailure(cause: unknown): Effect.Effect<Option.Option<never>, AuthUnavailable | InvalidTokenClaim> {
	const claim = cause instanceof Error ? Reflect.get(cause, "claim") : undefined;
	if (
		cause instanceof InvalidTokenClaim
		|| (cause instanceof Error
			&& ["ERR_JWT_CLAIM_VALIDATION_FAILED", "ERR_JWT_EXPIRED"].includes(String(Reflect.get(cause, "code")))
			&& typeof claim === "string")
	) {
		const failure = cause instanceof InvalidTokenClaim ? cause : new InvalidTokenClaim({ claim });
		return Effect.logWarning(failure.message).pipe(Effect.andThen(Effect.fail(failure)));
	}
	if (
		(isAPIError(cause) && (cause.status === "UNAUTHORIZED" || cause.status === "FORBIDDEN"))
		|| (cause instanceof Error && INVALID_TOKEN_ERRORS.has(String(Reflect.get(cause, "code"))))
	) {
		return Effect.succeed(Option.none());
	}
	return Effect.logError("MCP authentication verification failed", redact(cause)).pipe(
		Effect.andThen(Effect.fail(new AuthUnavailable({ message: "Authentication is temporarily unavailable" }))),
	);
}

function requiredClaim(value: unknown, claim: string) {
	if (typeof value !== "string" || value.trim() === "") {
		throw new InvalidTokenClaim({ claim });
	}
	return value;
}

export function bearer(jwks: JwksSource, audience: string, issuer: string) {
	return (token: string | undefined) => {
		if (!token) {
			return Effect.succeed(Option.none());
		}
		return Effect.tryPromise(async () => {
			const claims = await verifyJwsAccessToken(token, { jwksFetch: jwks, verifyOptions: { audience, issuer } });
			const sub = requiredClaim(claims.sub, "sub");
			const clientId = requiredClaim(claims.client_id, "client_id");
			const grantId = requiredClaim(claims.grant_id, "grant_id");
			if (typeof claims.scope !== "string" || !claims.scope.split(" ").includes("mcp")) {
				throw new InvalidTokenClaim({ claim: "scope" });
			}
			if (claims.cnf !== undefined) {
				throw new InvalidTokenClaim({ claim: "cnf" });
			}
			return { ...claims, "client_id": clientId, "grant_id": grantId, sub };
		}).pipe(
			Effect.map(Option.some),
			Effect.catch(({ cause }) => bearerFailure(cause)),
		);
	};
}
