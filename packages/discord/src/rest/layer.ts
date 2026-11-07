import { Layer } from "effect";
import { DiscordRest } from "#rest/service.ts";
import { DiscordRestLimits } from "#rest-limits/service.ts";

export const layer = DiscordRest.layer.pipe(Layer.provide(DiscordRestLimits.layer));
