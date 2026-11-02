import { Schema } from "effect";

export const authRefusals = {
	roleSeedFailed: { code: "AUTH_UNAVAILABLE", wire: "role_seed_failed" },
	signInRefused: { code: "SIGN_IN_REFUSED", wire: "sign_in_refused" },
	signInUnavailable: { code: "AUTH_UNAVAILABLE", wire: "sign_in_unavailable" },
} as const;

export const IdentityAuthFailureCode = Schema.Literals(Object.values(authRefusals).map(({ code }) => code));

export function identityAuthFailureCode(wire: unknown) {
	return Object.values(authRefusals).find((refusal) => refusal.wire === wire)?.code;
}
