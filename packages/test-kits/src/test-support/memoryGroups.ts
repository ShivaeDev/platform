import { Effect, Layer, Schema } from "effect";
import { Rpc, RpcClient, RpcGroup } from "effect/rpc";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command } from "@shivaedev/contract/operation.ts";
import { SensitiveFieldConflict } from "@shivaedev/errors/schemaFieldScope.ts";
import { InvalidRedactionMask } from "@shivaedev/errors/wireMask.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { layerMemoryProtocol } from "#contract/testing.ts";

const LoggedSet = Schema.Struct({ reps: Schema.Number.annotate({ sensitive: true }) });
const HiddenSets = Schema.Struct({ best: LoggedSet, logged: LoggedSet });
const Attempts = Schema.Number.check(Schema.isGreaterThan(0));
const Exhausted = Schema.Struct({ attempts: Attempts });
class SetRefused extends Schema.TaggedError<SetRefused>()("SetRefused", { reps: Schema.Number.annotate({ sensitive: true }) }) {}
const shownSets = { best: { reps: 12 }, logged: { reps: 8 } };
const PublicSet = Schema.Struct({ reps: Schema.Number });
// The generated wire's success names reps without sensitivity, as the build derives it from run's type.
const SetsModule = defineModule({
	name: "Sets",
	operations: [
		command("read", {
			invalidates: () => [],
			*run() {
				const read = yield* Effect.succeed(shownSets);
				if (read.logged.reps > read.best.reps) {
					return yield* new SetRefused({ reps: read.logged.reps });
				}
				return read;
			},
		}),
	],
	wire: { read: { rejections: { SetRefused }, success: Schema.Struct({ best: PublicSet, logged: PublicSet }) } },
});
const groups = {
	"a group whose best set shows reps that its logged set hides": RpcGroup.make(
		Rpc.make("Sets.read", { error: Exhausted, success: Schema.Struct({ best: Schema.Struct({ reps: Schema.Number }), logged: LoggedSet }) }),
	),
	"a group whose failure hides a positive count behind a mask of zero": RpcGroup.make(
		Rpc.make("Sets.read", {
			error: Schema.Struct({ attempts: Attempts.annotate({ redactionMask: 0, sensitive: true }) }),
			success: HiddenSets,
		}),
	),
	"a group whose sets all hide their reps": RpcGroup.make(Rpc.make("Sets.read", { error: Exhausted, success: HiddenSets })),
};

export type SetGroup = keyof typeof groups;

const sets = shownSets;

function refusedOrDie(defect: unknown) {
	return defect instanceof SensitiveFieldConflict || defect instanceof InvalidRedactionMask
		? Effect.succeed(`refused: ${defect.message}`)
		: Effect.die(defect);
}

export const memoryGroups = storyKit({
	create: () => ({}),
	name: "contract groups served in memory",
	stages: [],
	verbs: (_state, story) => ({
		readModuleSets: () => {
			story.tell(
				"a module spec serves a defined module whose rejection hides reps while its generated success names reps in memory, and reads its sets",
			);
			const protocol = layerMemoryProtocol(SetsModule.application).pipe(
				Layer.provide(SetsModule.application.toLayer({ "Sets.read": () => Effect.succeed(sets) })),
			);
			return RpcClient.make(SetsModule.application).pipe(
				Effect.flatMap((client) => client["Sets.read"]()),
				Effect.provide(protocol),
				Effect.scoped,
				Effect.catchDefect(refusedOrDie),
			);
		},
		readSets: (name: SetGroup, sensitiveKeys?: readonly string[]) => {
			story.tell(
				`a module spec serves ${name} in memory${sensitiveKeys === undefined ? "" : `, listing ${sensitiveKeys.join(", ")} as sensitive keys`}, and reads its sets`,
			);
			const group = groups[name];
			const protocol = layerMemoryProtocol(group, sensitiveKeys === undefined ? {} : { sensitiveKeys }).pipe(
				Layer.provide(group.toLayer({ "Sets.read": () => Effect.succeed(sets) })),
			);
			return RpcClient.make(group).pipe(
				Effect.flatMap((client) => client["Sets.read"]()),
				Effect.provide(protocol),
				Effect.scoped,
				Effect.catchDefect(refusedOrDie),
			);
		},
	}),
});
