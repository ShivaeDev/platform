import { engineConfiguration } from "#test/engineConfiguration.ts";
export const twoSubmissionsOfQuota = engineConfiguration("two submissions of quota", () => ({ noChange: true, quota: 2 }));
