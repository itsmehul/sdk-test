import type { APIClient, RequestOptions } from "../core/http";
import type { CreateEmbeddingResponse, EmbeddingCreateParams } from "../types";

export class Embeddings {
  readonly #client: APIClient;

  constructor(client: APIClient) {
    this.#client = client;
  }

  create(body: EmbeddingCreateParams, options?: RequestOptions): Promise<CreateEmbeddingResponse> {
    return this.#client.json({ method: "POST", path: "/embeddings", body, options });
  }
}
