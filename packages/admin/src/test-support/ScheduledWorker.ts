import { defineSchedule } from "@shivaedev/jobs/server/defineSchedule.ts";
import { Scheduled } from "./Scheduled.ts";

export const ScheduledWorker = defineSchedule({ ...Scheduled, cron: "0 0 1 1 *", queue: { retryLimit: 0 } });
