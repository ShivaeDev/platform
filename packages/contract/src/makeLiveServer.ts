import { Effect } from "effect";
import { standaloneLiveServer } from "#adapters/standaloneLiveServer.ts";

export const makeLiveServer = Effect.fn("LiveServer.makeLiveServer")(() => standaloneLiveServer)();
