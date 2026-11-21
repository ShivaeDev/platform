import { Schema } from "effect";

const delivery = { to: Schema.String, url: Schema.Redacted(Schema.String) };

export const AuthEmailJob = Schema.Union([
	Schema.Struct({ kind: Schema.Literals(["ConfirmAccount", "ConfirmNewAddress", "ResetPassword", "AccountAlreadyExists"]), ...delivery }),
	Schema.Struct({ kind: Schema.Literal("ApproveEmailChange"), newEmail: Schema.String, ...delivery }),
]);
export type AuthEmailJob = typeof AuthEmailJob.Type;

export const authEmailJobs = { name: "identity.auth-emails", schema: AuthEmailJob } as const;
