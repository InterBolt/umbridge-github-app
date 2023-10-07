import github from "./services/github";
import notion from "./services/notion";
import logger from "signale";

type TPullRequestOpenedHandler = Parameters<
  typeof github.app.webhooks.on<"pull_request.opened">
>[1];

export const handleEventPROpened: TPullRequestOpenedHandler = async ({
  payload,
}) => {
  const markdown = await notion.getMarkdown();
  await github.commentOnPR(
    payload.repository.name,
    payload.pull_request.number,
    markdown
  );

  logger.success(`Posted guidelines to PR: ${payload.pull_request.html_url}`);
};

export const handlePollReactions = async () => {
  const repos = await github.getRepos();
  const { prsToApprove, prsToDismiss } = await github.getPRs(repos);
  const approvalPromises = prsToApprove.map((pr) =>
    github.approve(pr.repo, pr.number)
  );
  const dismissalPromises = prsToDismiss.map((pr) =>
    github.dismiss(pr.repo, pr.number, pr.approvalReviewId)
  );
  await Promise.all(approvalPromises.concat(dismissalPromises));

  if (approvalPromises.length) {
    logger.success(`Approved ${approvalPromises.length} PRs`);
  }
  if (dismissalPromises.length) {
    logger.success(`Dismissed ${dismissalPromises.length} previous PR reviews`);
  }
};
