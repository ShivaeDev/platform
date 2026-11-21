import { authEmailJobs } from "@shivaedev/email/authEmailJobs.ts";
import { sessionSweep } from "#sessionSweep.ts";

export const foundationQueues = [authEmailJobs, sessionSweep] as const;
