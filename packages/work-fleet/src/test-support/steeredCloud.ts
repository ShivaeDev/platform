import { host } from "#test/hostStory.ts";
import { configureSteeringCloud } from "#test/steeringCloud.ts";
export const steeredCloud = host.trait("configuration", "an approved Cloud worker receives edited acceptance criteria", configureSteeringCloud);
