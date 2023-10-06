import { createNodeMiddleware } from "@octokit/webhooks";
import http from "http";
import { ServerConfig } from "./config";
import { handlePollReactions, handleEventPROpened } from "./handlers";
import github from "./services/github";

const pollServer = () => {
  console.log(`Server is polling for events every 7 seconds.`);
  setInterval(async () => {
    try {
      await handlePollReactions();
    } catch (error: any) {
      console.log("Polling server threw an error.");
      console.error(error);
    }
  }, 7000);
};

const webhookServer = () => {
  github.app.webhooks.on("pull_request.opened", handleEventPROpened);
  github.app.webhooks.onError((error) => {
    if (error.name === "AggregateError") {
      console.error(`Error processing request: ${error.event}`);
    } else {
      console.error(error);
    }
  });

  const middleware = createNodeMiddleware(github.app.webhooks, {
    path: "/events",
  });

  const eventServer = http.createServer(middleware);

  eventServer.listen(ServerConfig.port, () => {
    console.log(`Server is listening for events on port: ${ServerConfig.port}`);
    console.log("Press Ctrl + C to quit.");
  });
};

webhookServer();
pollServer();
