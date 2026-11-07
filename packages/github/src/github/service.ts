import { HttpClient } from "effect/http";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { bytes } from "#github/bytes.ts";
import { compareCommits } from "#github/compareCommits.ts";
import { createCheckRun } from "#github/createCheckRun.ts";
import { downloadArtifactArchive } from "#github/downloadArtifactArchive.ts";
import { findLatestCheckRun } from "#github/findLatestCheckRun.ts";
import { getCollaboratorPermission } from "#github/getCollaboratorPermission.ts";
import { getCommit } from "#github/getCommit.ts";
import { getIssue } from "#github/getIssue.ts";
import { getTree } from "#github/getTree.ts";
import { getUser } from "#github/getUser.ts";
import { graphql } from "#github/graphql.ts";
import { list } from "#github/list.ts";
import { listBounded } from "#github/listBounded.ts";
import { listCommits } from "#github/listCommits.ts";
import { listIssues } from "#github/listIssues.ts";
import { listPages } from "#github/listPages.ts";
import { listPullRequestFiles } from "#github/listPullRequestFiles.ts";
import { observations } from "#github/observations.ts";
import { read } from "#github/read.ts";
import { resource } from "#github/resource.ts";
import { text } from "#github/text.ts";
import { updateCheckRun } from "#github/updateCheckRun.ts";
import { upsertCheckRun } from "#github/upsertCheckRun.ts";
import { upsertStickyComment } from "#github/upsertStickyComment.ts";
import { write } from "#github/write.ts";
import { initializeGitHub } from "#initializeGitHub.ts";
import { TokenRefresh } from "#TokenRefresh.ts";

export const GitHub = defineService({
	id: "@shivaedev/github/GitHub",
	initialize: initializeGitHub,
	methods: (state) => ({
		bytes: bytes(state),
		compareCommits: compareCommits(state),
		createCheckRun: createCheckRun(state),
		downloadArtifactArchive: downloadArtifactArchive(state),
		findLatestCheckRun: findLatestCheckRun(state),
		getCollaboratorPermission: getCollaboratorPermission(state),
		getCommit: getCommit(state),
		getIssue: getIssue(state),
		getTree: getTree(state),
		getUser: getUser(state),
		graphql: graphql(state),
		list: genericMethod(list(state)),
		listBounded: genericMethod(listBounded(state)),
		listCommits: genericMethod(listCommits(state)),
		listIssues: genericMethod(listIssues(state)),
		listPages: genericMethod(listPages(state)),
		listPullRequestFiles: genericMethod(listPullRequestFiles(state)),
		observations: observations(state),
		read: read(state),
		resource: resource(state),
		text: text(state),
		updateCheckRun: updateCheckRun(state),
		upsertCheckRun: upsertCheckRun(state),
		upsertStickyComment: upsertStickyComment(state),
		write: write(state),
	}),
	requires: [HttpClient.HttpClient, GitHubToken, GitHubConfig, TokenRefresh],
});
