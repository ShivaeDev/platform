import { Layer } from "effect";
import { DiscordRestLimits } from "#rest-limits/service.ts";
import { DiscordRest } from "./service.ts";

export const layer = DiscordRest.layer.pipe(Layer.provide(DiscordRestLimits.layer));
