import { Semaphore } from "effect";

export const initialize = Semaphore.make(1);
