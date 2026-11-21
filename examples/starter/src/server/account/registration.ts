import { Account } from "@shivaedev/identity/Account.ts";
import { accountDeletion } from "@shivaedev/identity/server/better-auth/accountDeletion.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { AppAuth } from "#server/AppAuth.ts";

export const accountRegistration = {
	module: Account,
	ports: memoryStore,
	services: accountDeletion(AppAuth),
} satisfies AppModule;
