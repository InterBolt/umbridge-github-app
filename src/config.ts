import * as dotenv from "dotenv";
import AppRoutePath from "app-root-path";
import * as path from "path";
import * as fs from "fs";
import _ from "lodash";

dotenv.config({ path: path.resolve(AppRoutePath.path, ".env") });

const privateKeyPath = path.resolve(
  AppRoutePath.path,
  process.env.GITHUB_APP_PRIVATE_KEY_PATH as string
);

if (!fs.existsSync(privateKeyPath)) {
  throw new Error(`Please save a private key at: ${privateKeyPath}`);
}

export const ServerConfig = {
  env: process.env.NODE_ENV || "production",
  port: Number(process.env.PORT) as number,
};

export const GithubConfig = {
  reactionThreshold: Number(process.env.REACTION_THRESHOLD) as number,
  botName:
    _.toLower(process.env.GITHUB_APP_NAME as string)
      .split(" ")
      .join("-") + "[bot]",
  botPrefix: "UMBRIDGE",
  org: process.env.GITHUB_ORG_NAME as string,
  appId: process.env.GITHUB_APP_ID as string,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET as string,
  privateKeyPath: privateKeyPath,
};

export const NotionConfig = {
  pageId: process.env.NOTION_PAGE_ID as string,
  integrationToken: process.env.NOTION_INTEGRATION_TOKEN as string,
};
