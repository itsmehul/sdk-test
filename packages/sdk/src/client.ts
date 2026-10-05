import { APIClient, type ClientOptions } from "./core/http";
import { Chat } from "./resources/chat";
import { Embeddings } from "./resources/embeddings";
import { Models } from "./resources/models";

/**
 * Interfaze API client. Instances are independent, so create one per
 * credential or configuration and share it across your app.
 *
 * @example
 * const client = new Interfaze({ apiKey: process.env.INTERFAZE_API_KEY });
 * const completion = await client.chat.completions.create({
 *   model: "interfaze-beta",
 *   messages: [{ role: "user", content: "Hello" }],
 * });
 */
export class Interfaze extends APIClient {
  readonly chat: Chat;
  readonly models: Models;
  readonly embeddings: Embeddings;

  constructor(options: ClientOptions = {}) {
    super(options);
    this.chat = new Chat(this);
    this.models = new Models(this);
    this.embeddings = new Embeddings(this);
  }
}
