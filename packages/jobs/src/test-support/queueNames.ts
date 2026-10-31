import { Schema } from "effect";

export const emailQueue = { name: "send-email", schema: Schema.Struct({ userId: Schema.Number }) } as const;
export const cleanupSchedule = { name: "cleanup-mail" } as const;
export const queueNames = [emailQueue.name, cleanupSchedule.name] as const;
