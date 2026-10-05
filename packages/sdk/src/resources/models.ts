import type { APIClient, RequestOptions } from "../core/http";
import type { Model, ModelList } from "../types";

export class Models {
  readonly #client: APIClient;

  constructor(client: APIClient) {
    this.#client = client;
  }

  list(options?: RequestOptions): Promise<ModelList> {
    return this.#client.json({ method: "GET", path: "/models", options });
  }

  retrieve(model: string, options?: RequestOptions): Promise<Model> {
    return this.#client.json({
      method: "GET",
      path: `/models/${encodeURIComponent(model)}`,
      options,
    });
  }
}
