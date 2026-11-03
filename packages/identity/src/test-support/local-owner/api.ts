import { Effect, Layer, Option, Schema } from "effect";
import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Identity, SessionUser } from "#identity.ts";
import { AuthenticatedUser } from "#middleware.ts";
import { hasPermission, permissionMiddleware } from "#permission.ts";

const Manage = permission("app.manage");
const Read = permission("app.read");
export const Access = roleSet(role("owner", [Read, Manage]), role("reader", [Read]));
export const owner = { email: "owner@example.test", id: "local-owner", name: "Owner", role: "owner" };
export class OwnerOnly extends permissionMiddleware<OwnerOnly>()("@shivaedev/identity/test/OwnerOnly", Manage) {}

const Reads = contract("local", {
	queries: [
		query("profile", {
			readPolicy: (_payload, viewer) =>
				Effect.map(SessionUser, (user) => Option.isSome(viewer) && viewer.value.id === owner.id && hasPermission(user, Read)),
			reads: () => [],
			success: Schema.Struct({ actor: Schema.String, role: Schema.String }),
		}),
	],
}).middleware(AuthenticatedUser);
const Commands = contract("owner", {
	commands: [command("manage", { invalidates: () => [], success: Schema.String })],
}).middleware(OwnerOnly);
export const Api = Reads.merge(Commands);
export function handlers(audit: string[]) {
	return Layer.merge(
		Reads.application.toLayer({
			"local.profile": () =>
				Effect.gen(function* () {
					const actor = (yield* Identity).id;
					return { actor, role: (yield* SessionUser).role ?? "missing" };
				}),
		}),
		Commands.application.toLayer({
			"owner.manage": () =>
				Effect.map(Identity, ({ id }) => {
					audit.push(id);
					return id;
				}),
		}),
	);
}
