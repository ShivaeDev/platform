import { configureContinuationCloud } from "#test/continuationCloud.ts";
import { host } from "#test/hostStory.ts";
export const continuedCloud = host.trait("configuration", "a completed worker has a Cloud thread that can continue", configureContinuationCloud);
