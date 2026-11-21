import type { AuthEmailJob } from "#authEmailJobs.ts";

export interface AuthEmailCopy {
	readonly action: string;
	readonly footer?: string;
	readonly lines: readonly string[];
	readonly subject: string;
}

export type AuthEmailKind = AuthEmailJob["kind"];

export type AuthEmailCopies = {
	readonly [TKind in AuthEmailKind]: (message: AuthEmailJob & { readonly kind: TKind }) => AuthEmailCopy;
};

export const defaultAuthEmailCopy: AuthEmailCopies = {
	AccountAlreadyExists: () => ({
		action: "Sign in",
		footer: "If this was not you, you can ignore this email.",
		lines: ["Someone tried to create an account with this email address, but you already have one."],
		subject: "Sign in to your account",
	}),
	ApproveEmailChange: ({ newEmail }) => ({
		action: "Approve the change",
		footer: "If you did not ask for this, ignore this email and your address stays the same.",
		lines: [
			`Someone asked to change your account's email address to ${newEmail}.`,
			"Approve it and we will send a confirmation link to the new address.",
		],
		subject: "Approve your email change",
	}),
	ConfirmAccount: () => ({
		action: "Confirm your account",
		footer: "If you did not create an account, you can ignore this email.",
		lines: ["Confirm this email address to finish setting up your account."],
		subject: "Confirm your account",
	}),
	ConfirmNewAddress: () => ({
		action: "Confirm this address",
		footer: "If you did not ask to change your email address, you can ignore this email.",
		lines: ["Confirm this address to make it your account's sign-in email."],
		subject: "Confirm your new email address",
	}),
	ResetPassword: () => ({
		action: "Choose a new password",
		footer: "If you did not ask to reset your password, ignore this email and your password stays the same.",
		lines: ["Use this link to choose a new password."],
		subject: "Reset your password",
	}),
};
