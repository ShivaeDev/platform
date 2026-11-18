import { Effect } from "effect";
import { LiveSync } from "@shivaedev/contract/LiveSync.ts";

export const liveSyncLayer = LiveSync.application.toLayer({ "platform.liveSync.request": () => Effect.void });
