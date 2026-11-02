import { authEmail } from "#authEmail.ts";
import { sessionSweep } from "#sessionSweep.ts";

export const foundationQueues = [authEmail, sessionSweep] as const;
