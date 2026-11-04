import { Effect } from "effect";
import { confirmQueue as confirm } from "#confirmQueue.ts";
import type { Options, Snapshot } from "#model.ts";

type QueueConfirmation = Effect.Effect<Snapshot | undefined, Effect.Error<ReturnType<typeof confirm>>, Effect.Services<ReturnType<typeof confirm>>>;

export const confirmQueue = Effect.fn("GitHub.confirmQueue")((options: Options, snapshot: Snapshot): QueueConfirmation => confirm(options, snapshot));
