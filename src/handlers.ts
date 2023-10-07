import github from "./services/github";
import notion from "./services/notion";

type TPullRequestOpenedHandler = Parameters<
  typeof github.app.webhooks.on<"pull_request.opened">
>[1];

export const handleEventPROpened: TPullRequestOpenedHandler = async ({
  payload,
}) => {
  try {
    await github.init();

    const markdown = await notion.getMarkdown();
    await github.commentOnPR(
      payload.repository.name,
      payload.pull_request.number,
      markdown
    );
  } catch (error: any) {
    if (error.response) {
      console.error(
        `Error! Status: ${error.response.status}. Message: ${error.response.data.message}`
      );
    }
    console.error(error);
  }
};

export const handlePollReactions = async () => {
  try {
    await github.init();

    const startRequestCount = github.getRequestCount();
    const repos = await github.getRepos();
    const { prsToApprove, prsToDismiss } = await github.getPRs(repos);
    const approvalPromises = prsToApprove.map((pr) =>
      github.approve(pr.repo, pr.number)
    );
    const dismissalPromises = prsToDismiss.map((pr) =>
      github.dismiss(pr.repo, pr.number, pr.approvalReviewId)
    );
    await Promise.all(approvalPromises.concat(dismissalPromises));

    console.log(
      `${
        github.getRequestCount() - startRequestCount
      } requests made to GitHub API`
    );
    github.resetRequestCount();
  } catch (error: any) {
    console.log(error);
  }
};
