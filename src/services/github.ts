import { App } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { request } from "@octokit/request";
import fs from "fs";
import { GithubConfig } from "../config";
import logger from "signale";

class GithubService {
  app!: App;
  requestCount = 0;
  doRestRequest!: ReturnType<typeof request.defaults>;
  installationId!: number;

  constructor() {
    this.app = new App({
      appId: GithubConfig.appId,
      privateKey: fs.readFileSync(GithubConfig.privateKeyPath, "utf8"),
      webhooks: {
        secret: GithubConfig.webhookSecret,
      },
    });

    this.trackRequestsInterval();
  }

  init = async (retries: number = 0) => {
    if (typeof this.doRestRequest !== "undefined") {
      return;
    }

    const { octokit } = this.app;

    const installationsResponse = await octokit.request(
      "GET /app/installations"
    );
    const orgInstallations = installationsResponse.data.filter(
      (item) => (item.account || {}).login === GithubConfig.org
    );

    if (orgInstallations.length !== 1) {
      const retrySeconds = 10;
      logger.warn(
        `No installations found for org: ${GithubConfig.org}. Retrying in ${retrySeconds} seconds...`
      );
      await new Promise((resolve) =>
        setTimeout(() => resolve(null), retrySeconds * 1000)
      );
      await this.init(retries + 1);
    }

    this.installationId = orgInstallations[0].id;

    const auth = createAppAuth({
      appId: GithubConfig.appId,
      privateKey: fs.readFileSync(GithubConfig.privateKeyPath, "utf8"),
      installationId: this.installationId,
    });

    const restWithAuth = request.defaults({
      request: {
        hook: auth.hook,
      },
    });

    const doRestRequest = (url: string, opts: any) => {
      this.requestCount++;
      return restWithAuth(url, opts);
    };

    this.doRestRequest = doRestRequest as typeof restWithAuth;

    logger.info(`Github service initialized for app: ${GithubConfig.appId}`);
  };

  getRepos = async () => {
    await this.init();

    const reposResponse = await this.doRestRequest(
      "GET /installation/repositories",
      {
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    const repos = reposResponse.data.repositories
      .filter((r) => r.owner.login === GithubConfig.org)
      .map(({ name }) => name);

    return repos;
  };

  getPRs = async (repos: Array<string>) => {
    await this.init();

    const repoPRs = await Promise.all(
      repos.map(async (repo) => {
        const issuesCommentsResponse = await this.doRestRequest(
          "GET /repos/{owner}/{repo}/issues/comments",
          {
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
            },
            owner: GithubConfig.org,
            repo,
          }
        );

        const prs = issuesCommentsResponse.data
          .filter((c) => (c.user || {}).login === GithubConfig.botName)
          .map((c) => ({
            shouldApprove:
              ((c.reactions || {})["+1"] || 0) >=
              GithubConfig.reactionThreshold,
            number: Number(c.issue_url.split("/").reverse()[0]),
          }));

        return prs;
      })
    );

    const formattedPRs = repoPRs.reduce(
      (
        accum: Array<{ shouldApprove: boolean; repo: string; number: number }>,
        prs,
        i
      ) => {
        const repo = repos[i];
        return [
          ...accum,
          ...prs.map((pr) => ({
            ...pr,
            repo,
          })),
        ];
      },
      []
    );

    const allPrReviews = await Promise.all(
      formattedPRs.map((pr) =>
        this.doRestRequest(
          "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
          {
            owner: GithubConfig.org,
            repo: pr.repo,
            pull_number: pr.number,
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        )
      )
    );

    const allPrsWithApprovals = formattedPRs.map((pr, i) => ({
      ...pr,
      isApproved:
        allPrReviews[i].data
          .slice()
          .reverse()
          .find((d) => (d.user || {}).login === GithubConfig.botName)?.state ===
        "APPROVED",
      approvalReviewId: allPrReviews[i].data
        .slice()
        .reverse()
        .find((d) => (d.user || {}).login === GithubConfig.botName)
        ?.id as number,
    }));

    const prsToApprove = allPrsWithApprovals.filter(
      (d) => d.shouldApprove && !d.isApproved
    );

    const prsToDismiss = allPrsWithApprovals.filter(
      (d) => !d.shouldApprove && d.isApproved
    );

    return {
      prsToApprove,
      prsToDismiss,
    };
  };

  approve = async (repo: string, prNumber: number) => {
    await this.init();

    await this.doRestRequest(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      {
        owner: GithubConfig.org,
        repo: repo,
        pull_number: prNumber,
        body: `${GithubConfig.botPrefix}: You know, I really love rules.`,
        event: "APPROVE",
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
  };

  dismiss = async (repo: string, prNumber: number, reviewId: number) => {
    await this.init();

    await this.doRestRequest(
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals",
      {
        owner: GithubConfig.org,
        repo: repo,
        pull_number: prNumber,
        review_id: reviewId,
        message: `${GithubConfig.botPrefix}: I must not ignore rules.`,
        event: "DISMISS",
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
  };

  commentOnPR = async (repo: string, prNumber: number, comment: string) => {
    await this.init();

    await this.doRestRequest(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: GithubConfig.org,
        repo: repo,
        issue_number: prNumber,
        body: comment,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      }
    );
  };

  trackRequestsInterval = () => {
    setInterval(() => {
      logger.info(`Github requests in last 5 minutes: ${this.requestCount}`);
      this.requestCount = 0;
    }, 1000 * 60 * 5);
  };
}

const github = new GithubService();

export default github;
