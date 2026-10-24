import { engineConfiguration } from "#test/engineConfiguration.ts";
export const singleWorkerWithHumanDelivery = engineConfiguration("single worker with human delivery", () => ({ concurrency: 1, denyDelivery: true }));
