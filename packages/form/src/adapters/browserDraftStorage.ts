import { Layer } from "effect";
import { DraftStorageProvider } from "#persistence.ts";

export const browserDraftStorage = Layer.succeed(DraftStorageProvider, () => globalThis.localStorage);
