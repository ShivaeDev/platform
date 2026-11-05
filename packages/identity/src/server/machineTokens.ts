import { Effect, Option, Redacted, Schema } from "effect";
import { Digest, SecureRandom } from "effect/crypto";
import * as Hex from "effect/encoding/Hex";
import { Model } from "effect/schema";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import type { SessionUserValue } from "#identity.ts";
import { providerFailure } from "./providerFailure.ts";

class MachineToken extends Model.Class<MachineToken>("IdentityMachineToken")({
	id: Schema.String,
	name: Schema.String,
	ownerId: Schema.String,
	scope: Schema.String,
}) {}

export const machineTokens = Effect.fn("Identity.machineTokens")(function* (options: {
	readonly owner: Pick<SessionUserValue, "id" | "name" | "email">;
	readonly roles: RoleSet;
}) {
	const random = yield* SecureRandom.SecureRandom;
	const hashes = yield* Digest.Digest;
	const repository = yield* makeRepository(MachineToken, {
		idColumn: "id",
		spanPrefix: "MachineTokens",
		tableName: "identity_machine_tokens",
	});
	function digest(token: string) {
		return hashes.digestHex(Digest.sha256, new TextEncoder().encode(token));
	}
	return {
		issue: Effect.fn("MachineTokens.issue")(function* (input: { readonly name: string; readonly scope: string }) {
			yield* options.roles.resolve(input.scope);
			const token = Hex.encode(yield* random.randomBytes(32));
			const id = yield* digest(token);
			yield* repository.insertVoid({ id, name: input.name, ownerId: options.owner.id, scope: input.scope });
			return { id, ...input, token: Redacted.make(token) };
		}),
		resolve: Effect.fn("MachineTokens.resolve")(function* (token: string) {
			const stored = yield* digest(token).pipe(
				Effect.flatMap(repository.findById),
				Effect.map(Option.some),
				Effect.catchTag("NoSuchElementError", () => Effect.succeed(Option.none())),
				Effect.catch(providerFailure),
			);
			if (Option.isNone(stored) || stored.value.ownerId !== options.owner.id) {
				return Option.none();
			}
			const access = yield* options.roles.resolve(stored.value.scope).pipe(Effect.option);
			return Option.map(access, (grants) => ({
				machine: { id: stored.value.id, name: stored.value.name, scope: stored.value.scope },
				user: { ...options.owner, ...grants },
			}));
		}),
		revoke: Effect.fn("MachineTokens.revoke")((id: string) => repository.delete({ id, ownerId: options.owner.id })),
	};
});
