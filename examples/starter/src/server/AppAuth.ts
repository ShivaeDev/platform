import { authEmailQueue } from "@shivaedev/email/server/authEmailQueue.ts";
import { defineAuth } from "@shivaedev/identity/server/better-auth/define.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { AppAccess } from "#AppAccess.ts";
import { User } from "#roles/User.ts";

export const AppAuth = defineAuth({
	defaultRole: User.name,
	options: {
		advanced: { database: { validateSchema: true } },
		emailAndPassword: { enabled: true },
		session: { cookieCache: { enabled: false } },
		user: { changeEmail: { enabled: true } },
	},
	roles: AppAccess,
});

export const AuthEmails = authEmailQueue({
	paths: {
		AccountAlreadyExists: "/sign-in",
		ApproveEmailChange: "/auth/confirm",
		ConfirmAccount: "/auth/confirm",
		ConfirmNewAddress: "/auth/confirm",
		ResetPassword: "/reset-password",
	},
});

export const authEmailsRegistration = AuthEmails.registration satisfies AppModule;
