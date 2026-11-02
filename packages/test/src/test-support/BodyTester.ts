import type { Scope } from "effect";
import type { EffectItTest } from "#types.ts";

type BodyTest = EffectItTest<Scope.Scope, []>;

export interface BodyTester extends BodyTest {
	readonly fails: BodyTest;
	readonly only: BodyTest;
	readonly runIf: (condition: boolean) => BodyTest;
	readonly skip: BodyTest;
	readonly skipIf: (condition: boolean) => BodyTest;
}
