import { DurableObject } from "cloudflare:workers";
import { Context } from "hono";
import { Env } from ".";

export interface Proxy {
    base_url(): string;

    // Environment variable name for the real API key of this proxy
    realApiKeyEnvName(): string;

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

    realApiKeyEnvName(): string {
        throw new Error("Method 'realApiKeyEnvName()' must be implemented.");
    }

    /**
     * Validate and potentially replace the API key
     * 
     * Logic:
     * - If {realApiKeyEnvName} (e.g., OPENAI_API_KEY) is configured:
     *   - Validate user's key against ALLOWED_PROXY_KEYS
     *   - If valid, replace with the real API key
     *   - If invalid, return 403
     * - If {realApiKeyEnvName} is NOT configured:
     *   - Pass through the user's token directly (no validation)
     *
     * @returns { valid: true, apiKey: string } if validation passes or is disabled
     * @returns { valid: false, error: Response } if validation fails
     */
    protected validateApiKey(
        c: Context
    ): { valid: true; apiKey: string } | { valid: false; error: Response } {
        const env = c.env as Env;
        const authHeader = c.req.header("Authorization");
        const apiKey = authHeader?.split(" ")[1];

        if (!apiKey) {
            return {
                valid: false,
                error: c.json({ error: "API key not provided" }, 401) as unknown as Response,
            };
        }

        // Check if real API key is configured
        const realApiKeyEnvName = this.realApiKeyEnvName();
        const realApiKey = (env as unknown as Record<string, string>)[realApiKeyEnvName];

        if (!realApiKey) {
            // Real API key not configured, pass through the user's token
            return { valid: true, apiKey };
        }

        // Real API key is configured, validation is required
        // Read allowed keys from environment variable
        const allowedKeysStr = env.ALLOWED_PROXY_KEYS;
        console.log("allowedKeysStr:", allowedKeysStr, "type:", typeof allowedKeysStr);
        
        const allowedKeys: string[] = allowedKeysStr
            ? allowedKeysStr.split(",").map((k) => k.trim())
            : [];

        console.log("allowedKeys:", JSON.stringify(allowedKeys), "length:", allowedKeys.length);
        console.log("apiKey:", apiKey);

        if (allowedKeys.length === 0) {
            // No allowed keys configured but real API key exists, reject all requests
            return {
                valid: false,
                error: c.json({ error: "Invalid API key, no allowed keys configured" }, 403) as unknown as Response,
            };
        }
        if (!allowedKeys.includes(apiKey)) {
            // Key not in allowed list
            return {
                valid: false,
                error: c.json({ error: "Invalid API key, not in allowed keys" }, 403) as unknown as Response,
            };
        }

        // Key is valid, replace with real API key
        return { valid: true, apiKey: realApiKey };
    }

    async proxyRequest(
        c: Context,
        path: string,
        useDoStubCall: boolean
    ): Promise<Response> {
        try {
            const validationResult = this.validateApiKey(c);
            if (!validationResult.valid) {
                return validationResult.error;
            }
            const apiKey = validationResult.apiKey;
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
    apiKeyEnvName?: string;

    constructor(url: string, apiKeyEnvName?: string) {
        super();
        this.url = url;
        this.apiKeyEnvName = apiKeyEnvName;
    }

    base_url(): string {
        return this.url;
    }

    realApiKeyEnvName(): string {
        return this.apiKeyEnvName ?? "";
    }
}

export class OpenAIProxy extends BaseProxy {
    base_url(): string {
        return "https://api.openai.com";
    }

    realApiKeyEnvName(): string {
        return "OPENAI_API_KEY";
    }
}

export class OpenRouterProxy extends BaseProxy {
    base_url(): string {
        return "https://openrouter.ai";
    }

    realApiKeyEnvName(): string {
        return "OPENROUTER_API_KEY";
    }
}

export class AnthropicProxy extends BaseProxy {
    base_url(): string {
        return "https://api.anthropic.com";
    }

    realApiKeyEnvName(): string {
        return "ANTHROPIC_API_KEY";
    }
}

export class GeminiProxy extends BaseProxy {
    base_url(): string {
        return "https://generativelanguage.googleapis.com";
    }

    realApiKeyEnvName(): string {
        return "GEMINI_API_KEY";
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
