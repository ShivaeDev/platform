import { Account } from "@shivaedev/identity/Account.ts";
import { accountDeletion } from "@shivaedev/identity/server/better-auth/accountDeletion.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { AppAuth } from "#server/AppAuth.ts";

export const accountRegistration = {
	module: Account,
	services: accountDeletion(AppAuth),
} satisfies AppModule;
