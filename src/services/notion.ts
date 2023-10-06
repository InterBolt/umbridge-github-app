import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { NotionConfig } from "../config";
import { stripIndent } from "common-tags";

class Notion {
  notionToMarkdown!: NotionToMarkdown;

  constructor() {
    this.notionToMarkdown = new NotionToMarkdown({
      notionClient: new Client({
        auth: NotionConfig.integrationToken,
      }),
    });
  }

  async getMarkdown() {
    const mdblocks = await this.notionToMarkdown.pageToMarkdown(
      NotionConfig.pageId
    );
    return stripIndent`
      <details>
        <summary>Best Practices</summary>
        ${this.notionToMarkdown.toMarkdownString(mdblocks).parent}
      </details>
    `.trim();
  }
}

const notion = new Notion();

export default notion;
