import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { MaybeAuthenticated } from "@shivaedev/identity/middleware.ts";
import { defineRepository } from "@shivaedev/sql/defineRepository.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import type { AppModule } from "#AppModule.ts";

// The server's model marks address sensitive once; nothing else in the module does.
class Member extends Model.Class<Member>("Member")({
	address: Schema.String.annotate({ sensitive: true }),
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	name: Schema.String,
}) {}

const MembersRepository = defineRepository({
	id: "@shivaedev/server/test/MembersRepository",
	initialize: makeRepository(Member, { idColumn: "id", spanPrefix: "Members", tableName: "members" }),
});

function toMember({ address, id, name }: Member) {
	return { address, id, name };
}

const storedMember = Effect.fnUntraced(function* (id: number) {
	const members = yield* MembersRepository;
	return yield* Effect.orDie(members.findById(id));
});

function join(address: Schema.String) {
	return command("join", {
		invalidates: () => [],
		payload: { address, name: Schema.String },
		*run(member) {
			const members = yield* MembersRepository;
			return toMember(yield* members.insert(Member.insert.make({ address: member.address, name: member.name })));
		},
	});
}

const Show = query("show", {
	payload: { id: Schema.Number },
	*run({ id }) {
		const member = toMember(yield* storedMember(id));
		yield* Effect.logInfo("member shown", member);
		return member;
	},
});

const Audit = command("audit", {
	invalidates: () => [],
	payload: { id: Schema.Number },
	*run({ id }) {
		return yield* Effect.die({ member: toMember(yield* storedMember(id)) });
	},
});

// Stands in for the generated wire: a success derived from run's type carries no sensitivity.
const MemberWire = Schema.Struct({ address: Schema.String, id: Schema.Number, name: Schema.String });
const membersWire = {
	audit: { rejections: {}, success: Schema.Never },
	join: { rejections: {}, success: MemberWire },
	show: { rejections: {}, success: MemberWire },
} as const;

export const Members = defineModule({
	middleware: MaybeAuthenticated,
	name: "members",
	operations: [join(Schema.String), Show, Audit],
	requires: [MembersRepository],
	wire: membersWire,
});

const PrivateJoinMembers = defineModule({
	middleware: MaybeAuthenticated,
	name: "members",
	operations: [join(Schema.String.annotate({ sensitive: true })), Show, Audit],
	requires: [MembersRepository],
	wire: membersWire,
});

const migrations = {
	loader: Migrator.fromRecord({
		"003_members": SqlClient.SqlClient.use((sql) => sql`create table members (id serial primary key, name text not null, address text not null)`),
	}),
};

export const membersModule = { migrations, module: Members, services: MembersRepository.layer } satisfies AppModule;

export const privateJoinMembersModule = {
	migrations,
	module: PrivateJoinMembers,
	services: MembersRepository.layer,
} satisfies AppModule;
