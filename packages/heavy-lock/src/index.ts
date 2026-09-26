export { acquireHeavyLock, type HeavyLockOptions, type HeavyLockServices } from "./acquire.ts";
export { HeavyLockError } from "./error.ts";
export { HeldLock, type HeldLockShape } from "./held-lock.ts";
export { HOLDER_ID_ENV, Holder } from "./holder.ts";
export { heavyLockLayer, withHeavyLock } from "./with-heavy-lock.ts";
