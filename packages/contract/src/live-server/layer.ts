import { Layer } from "effect";
import { LiveDispatcher } from "#LiveDispatcher.ts";
import { LiveServer } from "#live-server/service.ts";

export const liveServerLayer = LiveServer.layer.pipe(Layer.provide(LiveDispatcher.layer));
