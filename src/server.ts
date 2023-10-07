import { createNodeMiddleware } from "@octokit/webhooks";
import http from "http";
import { ServerConfig } from "./config";
import { handlePollReactions, handleEventPROpened } from "./handlers";
import github from "./services/github";
import logger from "signale";

const pollServer = () => {
  logger.info(
    `Polling server started with interval: ${ServerConfig.pollingInterval}ms`
  );
  setInterval(async () => {
    try {
      await handlePollReactions();
    } catch (error: any) {
      logger.error(error);
    }
  }, ServerConfig.pollingInterval);
};

const webhookServer = () => {
  github.app.webhooks.on("pull_request.opened", handleEventPROpened);
  github.app.webhooks.onError((error) => {
    if (error.name === "AggregateError") {
      logger.error(`Error processing request: ${error.event}`);
    }
    logger.error(error);
  });

  const middleware = createNodeMiddleware(github.app.webhooks, {
    path: "/events",
  });

  const eventServer = http.createServer(middleware);

  eventServer.listen(ServerConfig.port, () => {
    logger.info(`Event server listening on port: ${ServerConfig.port}`);
  });
};

webhookServer();
pollServer();
