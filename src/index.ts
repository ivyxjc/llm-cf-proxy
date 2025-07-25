import { Hono } from "hono";
import { cors } from "hono/cors";
import { DurableObject } from "cloudflare:workers";
import { getWorkerLocation, handlePath, useDOStubCall } from "./util";
import { AnthropicProxy, LlmProxyDO, OpenAIProxy, OpenRouterProxy } from "./proxy";

export interface Env {
    LLM_PROXY_DO: DurableObjectNamespace<LlmProxyDO>;
}

const app = new Hono<{ Bindings: Env }>();
const openaiProxy = new OpenAIProxy();
const openRouterProxy= new OpenRouterProxy();
const anthropicProxy = new AnthropicProxy();

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
        const url = new URL(c.req.url);
        let path = handlePath(url, "openai");
        return openaiProxy.proxyRequest(c, path, await useDOStubCall());
    } catch (error) {
        console.error("Error in proxy request:", error);
        return c.json({ error: "Internal server error" }, 500);
    }
});

app.post("/openrouter/*", async (c) => {
    try {
        // Get path and query string from the request
        const url = new URL(c.req.url);
        let path = handlePath(url, "openrouter");
        return openRouterProxy.proxyRequest(c, path, await useDOStubCall());
    } catch (error) {
        console.error("Error in proxy request:", error);
        return c.json({ error: "Internal server error" }, 500);
    }
});

app.post("/anthropic/*", async (c) => {
    try {
        // Get path and query string from the request
        const url = new URL(c.req.url);
        let path = handlePath(url, "anthropic");
        return anthropicProxy.proxyRequest(c, path, await useDOStubCall());
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
export default app;

export { LlmProxyDO };
