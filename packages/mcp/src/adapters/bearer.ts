import { APIError, isAPIError } from "better-auth/api";
import { verifyJwsAccessToken } from "better-auth/oauth2";
import { Effect, Option } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";

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

function bearerFailure(cause: unknown) {
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

export function bearer(jwks: JwksSource, audience: string, issuer: string) {
	return (token: string | undefined) => {
		if (!token) {
			return Effect.succeed(Option.none());
		}
		return Effect.tryPromise(async () => {
			const claims = await verifyJwsAccessToken(token, { jwksFetch: jwks, verifyOptions: { audience, issuer } });
			if (typeof claims.scope !== "string" || !claims.scope.split(" ").includes("mcp") || claims.cnf !== undefined) {
				throw new APIError("UNAUTHORIZED");
			}
			return claims;
		}).pipe(
			Effect.map(Option.some),
			Effect.catch(({ cause }) => bearerFailure(cause)),
		);
	};
}
