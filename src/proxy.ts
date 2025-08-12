import { DurableObject } from "cloudflare:workers";
import { Context } from "hono";
import { Env } from ".";
export interface Proxy {
    base_url(): string;

    proxyRequest(
        context: Context,
        path: string,
        useDoStubCall: boolean
    ): Promise<Response>;
}

class BaseProxy implements Proxy {
    base_url(): string {
        throw new Error("Method 'base_url()' must be implemented.");
    }

    async proxyRequest(
        c: Context,
        path: string,
        useDoStubCall: boolean
    ): Promise<Response> {
        try {
            const apiKey = c.req.header("Authorization")?.split(" ")[1];
            if (!apiKey) {
                return c.json({ error: "API key not configured" }, 500);
            }
            // Get query string from the request
            const url = new URL(c.req.url);
            let queryString = url.search;

            if (queryString.startsWith("?")) {
                // Remove leading "?" from the query string
                queryString = queryString.slice(1);
            }

            const body = await c.req.json();
            let targetUrl = `${this.base_url()}/${path}`;
            if (queryString) {
                // Append query string to the target URL
                targetUrl += `?${queryString}`;
            }
            const headers = {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type":
                    c.req.header("Content-Type") || "application/json",
                "User-Agent":
                    c.req.header("User-Agent") || "PostmanRuntime/7.44.1",
                Connection: c.req.header("Connection") || "keep-alive",
            };
            console.log("send request to " + targetUrl);
            if (useDoStubCall) {
                console.log(`Using Durable Object for proxy request ...`);
                const doId = c.env.LLM_PROXY_DO.idFromName("wnam");

                // Create Durable Object instance for the specified region
                const doStub = c.env.LLM_PROXY_DO.get(doId, {
                    locationHint: "wnam" as DurableObjectLocationHint,
                });

                // Call the Durable Object to make the request
                const result: Response = await doStub.proxyRequest(targetUrl, {
                    method: c.req.method,
                    headers,
                    body: JSON.stringify(body),
                });

                // Clone the response to avoid body already read issues
                return new Response(result.body, {
                    status: result.status,
                    statusText: result.statusText,
                    headers: result.headers,
                });
            } else {
                const result: Response = await fetch(targetUrl, {
                    method: c.req.method,
                    headers,
                    body: JSON.stringify(body),
                });

                // Clone the response to avoid body already read issues
                return new Response(result.body, {
                    status: result.status,
                    statusText: result.statusText,
                    headers: result.headers,
                });
            }
        } catch (error) {
            console.error("Error in proxy request:", error);
            return c.json({ error: "Internal server error" }, 500);
        }
    }
}

export class CommonProxy extends BaseProxy {
    url: string;

    constructor(url: string) {
        super();
        this.url = url;
    }

    base_url(): string {
        return this.url;
    }
}

export class OpenAIProxy extends BaseProxy {
    base_url(): string {
        return "https://api.openai.com";
    }
}

export class OpenRouterProxy extends BaseProxy {
    base_url(): string {
        return "https://openrouter.ai";
    }
}

export class AnthropicProxy extends BaseProxy {
    base_url(): string {
        return "https://api.anthropic.com";
    }
}

export class GeminiProxy extends BaseProxy {
    base_url(): string {
        return "https://generativelanguage.googleapis.com";
    }
}

// Durable Object class for handling OpenAI proxy requests from specific regions
export class LlmProxyDO extends DurableObject {
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
    }

    async proxyRequest(
        input: RequestInfo | URL,
        init?: RequestInit<RequestInitCfProperties>
    ): Promise<Response> {
        try {
            const response = await fetch(input, init);

            console.debug(
                `Response status: ${
                    response.status
                }, Content-Type: ${response.headers.get("content-type")}`
            );
            return response;
        } catch (error) {
            console.error("Error in Durable Object proxy request:", error);
            throw error;
        }
    }

    async kill() {
        // Throwing an error in `blockConcurrencyWhile` will terminate the Durable Object instance
        // https://developers.cloudflare.com/durable-objects/api/state/#blockconcurrencywhile
        this.ctx.blockConcurrencyWhile(async () => {
            throw "killed";
        });
    }
}
