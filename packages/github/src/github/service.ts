import { HttpClient } from "effect/http";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { initializeGitHub } from "#initializeGitHub.ts";
import { TokenRefresh } from "#TokenRefresh.ts";
import { bytes } from "./bytes.ts";
import { compareCommits } from "./compareCommits.ts";
import { createCheckRun } from "./createCheckRun.ts";
import { downloadArtifactArchive } from "./downloadArtifactArchive.ts";
import { findLatestCheckRun } from "./findLatestCheckRun.ts";
import { getCollaboratorPermission } from "./getCollaboratorPermission.ts";
import { getCommit } from "./getCommit.ts";
import { getIssue } from "./getIssue.ts";
import { getTree } from "./getTree.ts";
import { getUser } from "./getUser.ts";
import { graphql } from "./graphql.ts";
import { list } from "./list.ts";
import { listCommits } from "./listCommits.ts";
import { listIssues } from "./listIssues.ts";
import { listPullRequestFiles } from "./listPullRequestFiles.ts";
import { observations } from "./observations.ts";
import { read } from "./read.ts";
import { resource } from "./resource.ts";
import { text } from "./text.ts";
import { updateCheckRun } from "./updateCheckRun.ts";
import { upsertCheckRun } from "./upsertCheckRun.ts";
import { upsertStickyComment } from "./upsertStickyComment.ts";
import { write } from "./write.ts";

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
		listCommits: genericMethod(listCommits(state)),
		listIssues: genericMethod(listIssues(state)),
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
