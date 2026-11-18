import { Effect, Layer, Schema } from "effect";
import { Rpc, RpcClient, RpcGroup } from "effect/rpc";
import { SensitiveFieldConflict } from "@shivaedev/errors/schemaFieldScope.ts";
import { InvalidRedactionMask } from "@shivaedev/errors/wireMask.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { layerMemoryProtocol } from "#contract/testing.ts";

const LoggedSet = Schema.Struct({ reps: Schema.Number.annotate({ sensitive: true }) });
const HiddenSets = Schema.Struct({ best: LoggedSet, logged: LoggedSet });
const Attempts = Schema.Number.check(Schema.isGreaterThan(0));
const Exhausted = Schema.Struct({ attempts: Attempts });
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

const sets = { best: { reps: 12 }, logged: { reps: 8 } };

export const memoryGroups = storyKit({
	create: () => ({}),
	name: "contract groups served in memory",
	stages: [],
	verbs: (_state, story) => ({
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
				Effect.catchDefect((defect) =>
					defect instanceof SensitiveFieldConflict || defect instanceof InvalidRedactionMask
						? Effect.succeed(`refused: ${defect.message}`)
						: Effect.die(defect),
				),
			);
		},
	}),
});
