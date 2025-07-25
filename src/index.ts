import { Hono } from "hono";
import { cors } from "hono/cors";
import { DurableObject } from "cloudflare:workers";
import { getWorkerLocation } from "./util";

export interface Env {
    LLM_PROXY_DO: DurableObjectNamespace<LlmProxyDO>;
}

const app = new Hono<{ Bindings: Env }>();

app.use(
    "*",
    cors({
        origin: "*",
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
    })
);

app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/openai/*", async (c) => {
    try {
        const apiKey = c.req.header("Authorization")?.split(" ")[1];
        if (!apiKey) {
            return c.json({ error: "API key not configured" }, 500);
        }

        // Get path and query string from the request
        const url = new URL(c.req.url);
        let path = url.pathname;
        let queryString = url.search;

        if (path.startsWith("/openai/")) {
            // Remove "/openai" prefix from the path
            path = path.replace(/^\/openai/, "");
        }
        if (path.startsWith("openai/")) {
            // Handle cases where the path starts with "openai/"
            path = path.replace(/^openai\//, "");
        }

        if (queryString.startsWith("?")) {
            // Remove leading "?" from the query string
            queryString = queryString.slice(1);
        }

        const body = await c.req.json();
        const doId = c.env.LLM_PROXY_DO.idFromName("wnam");

        // Create Durable Object instance for the specified region
        const doStub = c.env.LLM_PROXY_DO.get(doId, {
            locationHint: "wnam" as DurableObjectLocationHint,
        });

        // Call the Durable Object to make the request
        const result: any = await doStub.proxyRequest({
            path,
            queryString,
            body,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type":
                    c.req.header("Content-Type") || "application/json",
                "User-Agent":
                    c.req.header("User-Agent") || "PostmanRuntime/7.44.1",
                Connection: c.req.header("Connection") || "keep-alive",
            },
        });

        // Kill the DO instance after use to avoid extra resource usage
        try {
            await doStub.kill();
        } catch (err) {
            // An error here is expected, ignore it
        }

        return new Response(JSON.stringify(result.data), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error in proxy request:", error);
        return c.json({ error: "Internal server error" }, 500);
    }
});

app.onError((err, c) => {
    console.error("Global error handler:", err);
    return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => {
    return c.json({ error: "Not found" }, 404);
});

// Durable Object class for handling OpenAI proxy requests from specific regions
export class LlmProxyDO extends DurableObject {
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
    }

    async proxyRequest(request: {
        path: string;
        queryString: string;
        body: any;
        headers: Record<string, string>;
    }): Promise<{ data: unknown; status: number }> {
        const colo = (await getWorkerLocation()) as string;
        console.log(`Send request from (DurableObject) at ${colo}...`);

        try {
            const response = await fetch(
                `https://api.openai.com${request.path}${
                    request.queryString ? "?" + request.queryString : ""
                }`,
                {
                    method: "POST",
                    headers: request.headers,
                    body: JSON.stringify(request.body),
                }
            );

            const data = (await response.json()) as any;
            return {
                data,
                status: response.status,
            };
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

export default app;
