import { Context } from "effect";

export interface HeldLockShape {
	readonly env: Readonly<Record<string, string>>;
}

export class HeldLock extends Context.Service<HeldLock, HeldLockShape>()("@shivaedev/heavy-lock/HeldLock") {}
