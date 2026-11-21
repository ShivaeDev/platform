import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { jobModule } from "@shivaedev/jobs/server/jobModule.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { defineRepository } from "@shivaedev/sql/defineRepository.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import type { AppModule } from "#AppModule.ts";

// The stored model marks address sensitive once; the queues, handlers and RPC schemas carry no sensitivity.
class Member extends Model.Class<Member>("Member")({
	address: Schema.String.annotate({ sensitive: true }),
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	name: Schema.String,
}) {}

const MemberCardsRepository = defineRepository({
	id: "@shivaedev/server/test/MemberCardsRepository",
	initialize: makeRepository(Member, { idColumn: "id", spanPrefix: "MemberCards", tableName: "card_members" }),
});

const MemberJob = Schema.Struct({ id: Schema.Number });
const retryNever = { retryLimit: 0 };
const worker = { pollingIntervalSeconds: 0.5 };
export const PrintCard = defineQueue({ name: "members.card", queue: retryNever, schema: MemberJob, worker });
export const AuditMember = defineQueue({ name: "members.audit", queue: retryNever, schema: MemberJob, worker });
export const BillMember = defineQueue({ name: "members.bill", queue: retryNever, schema: MemberJob, worker });
export const ChargeMember = defineQueue({ name: "members.charge", queue: retryNever, schema: MemberJob, worker });
const MemberJobs = makePgBoss("test/modules/MemberJobs");

export const MemberCardsApi = RpcGroup.make(
	Rpc.make("join", { payload: { address: Schema.String, name: Schema.String }, success: Schema.Number }),
	Rpc.make("printCard", { payload: MemberJob, success: Schema.String }),
	Rpc.make("audit", { payload: MemberJob, success: Schema.String }),
	Rpc.make("bill", { payload: MemberJob, success: Schema.String }),
	Rpc.make("charge", { payload: MemberJob, success: Schema.String }),
	Rpc.make("printedAddresses", { success: Schema.Array(Schema.String) }),
);

const storedMember = Effect.fnUntraced(function* ({ id }: typeof MemberJob.Type) {
	const members = yield* MemberCardsRepository;
	const { address, name } = yield* Effect.orDie(members.findById(id));
	return { address, id, name };
});

const printCard = Effect.fnUntraced(function* (job: typeof MemberJob.Type) {
	const member = yield* storedMember(job);
	yield* Effect.annotateCurrentSpan("member", member);
	yield* Effect.logInfo("member card printed", member);
	const sql = yield* SqlClient.SqlClient;
	yield* sql`insert into printed_cards (address) values (${member.address})`;
});

function audit(job: typeof MemberJob.Type) {
	return storedMember(job).pipe(
		Effect.flatMap((member) => Effect.die({ member })),
		Effect.tapCause((cause) => Effect.logError("member audit failed", cause)),
		Effect.withErrorReporting,
	);
}

function bill({ id }: typeof MemberJob.Type) {
	// A computed third-party reference that no repository model describes.
	return Effect.logInfo("member billed", { customerReference: `cus_${id}`, id });
}

function charge({ id }: typeof MemberJob.Type) {
	return Effect.fail({ _tag: "ChargeDeclined", customerReference: `cus_${id}`, id });
}

function enqueue(queue: typeof PrintCard | typeof AuditMember | typeof BillMember | typeof ChargeMember) {
	return (job: typeof MemberJob.Type) => MemberJobs.use((jobs) => jobs.enqueue(queue, job)).pipe(Effect.orDie, Effect.map(Option.getOrThrow));
}

const mailerStarted = Layer.effectDiscard(Effect.logInfo("member mailer connected", { host: "smtp.example.test", password: "mail-secret" }));

const memberJobs = jobModule(MemberJobs.layer, {
	jobs: [PrintCard.handle(printCard), AuditMember.handle(audit), BillMember.handle(bill), ChargeMember.handle(charge)],
});

export const memberCardsModule = {
	group: MemberCardsApi,
	handlers: MemberCardsApi.toLayer({
		audit: enqueue(AuditMember),
		bill: enqueue(BillMember),
		charge: enqueue(ChargeMember),
		join: ({ address, name }) =>
			MemberCardsRepository.use((members) => members.insert(Member.insert.make({ address, name }))).pipe(
				Effect.orDie,
				Effect.map(({ id }) => id),
			),
		printCard: enqueue(PrintCard),
		printedAddresses: () =>
			SqlClient.SqlClient.use((sql) => sql<{ address: string }>`select address from printed_cards order by address`).pipe(
				Effect.orDie,
				Effect.map((rows) => rows.map((row) => row.address)),
			),
	}),
	migrations: {
		loader: Migrator.fromRecord({
			"002_member_cards": SqlClient.SqlClient.use((sql) =>
				sql`create table card_members (id serial primary key, name text not null, address text not null)`.pipe(
					Effect.andThen(sql`create table printed_cards (address text not null)`),
				),
			),
		}),
	},
	name: "member cards",
	queues: memberJobs.queues,
	services: MemberCardsRepository.layer.pipe(Layer.merge(MemberJobs.layer({ jobs: [PrintCard, AuditMember, BillMember, ChargeMember] }))),
	workers: Layer.merge(memberJobs.workers, mailerStarted),
} satisfies AppModule;
