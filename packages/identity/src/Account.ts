import { Schema } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command } from "@shivaedev/contract/operation.ts";
import { identityAccountWire } from "#generated/Account.ts";
import { AuthenticatedUser } from "#middleware.ts";
import { AccountDeletion } from "#server/AccountDeletion.ts";

const DeleteAccount = command("delete", {
	payload: { password: Schema.String },
	*run({ password }) {
		yield* (yield* AccountDeletion).delete(password);
	},
});

export const Account = defineModule({
	middleware: AuthenticatedUser,
	name: "identity.account",
	operations: [DeleteAccount],
	wire: identityAccountWire,
});
