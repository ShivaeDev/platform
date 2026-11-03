import { Crypto, type Duration, Effect, Option, Redacted } from "effect";
import * as Hex from "effect/encoding/Hex";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import type { SessionUserValue } from "#identity.ts";
import { localTransport } from "#server/adapters/local.ts";
import { machineTokens } from "./machineTokens.ts";
import type { SessionPolicy } from "./SessionPolicy.ts";

export const localOwner = Effect.fn("Identity.localOwner")(function* (options: {
	readonly owner: Pick<SessionUserValue, "id" | "name" | "email"> & { readonly role: string };
	readonly roles: RoleSet;
	readonly streamRevalidationInterval?: Duration.Input;
}) {
	const { owner, roles } = options;
	const access = yield* roles.resolve(owner.role);
	const crypto = yield* Crypto.Crypto;
	const token = Redacted.make(Hex.encode(yield* crypto.randomBytes(32)));
	const machines = yield* machineTokens({ owner, roles });
	const allowed = localTransport();
	const sessions: SessionPolicy["Service"] = {
		origin: (request) => allowed({ headers: request.headers, remoteAddress: request.remoteAddress ?? Option.none() }),
		provider: {
			get: (headers) => {
				const bearer = /^Bearer (?<token>\S+)$/iu.exec(headers.authorization ?? "")?.groups?.token;
				if (bearer === undefined) {
					return Effect.succeed(Option.none());
				}
				return bearer === Redacted.value(token) ? Effect.succeed(Option.some({ user: { ...owner, ...access } })) : machines.resolve(bearer);
			},
		},
		streamRevalidationInterval: options.streamRevalidationInterval,
	};
	return { machines, sessions, token };
});
