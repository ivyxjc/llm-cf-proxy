import { Hono } from "hono";
import { cors } from "hono/cors";
import { DurableObject } from "cloudflare:workers";
import { getWorkerLocation, handlePath, useDOStubCall } from "./util";
import {
    AnthropicProxy,
    CommonProxy,
    GeminiProxy,
    LlmProxyDO,
    OpenAIProxy,
    OpenRouterProxy,
    Proxy,
} from "./proxy";
import { Context } from "hono";

export interface Env {
    LLM_PROXY_DO: DurableObjectNamespace<LlmProxyDO>;
    // Comma-separated list of allowed proxy keys (required when real API key is configured)
    ALLOWED_PROXY_KEYS?: string;
    // Real API keys for each provider
    // If configured: validate user key against ALLOWED_PROXY_KEYS, then replace with real key
    // If not configured: pass through user's token directly
    OPENAI_API_KEY?: string;
    OPENROUTER_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    GEMINI_API_KEY?: string;
    MOONSHOT_API_KEY?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Proxy configuration map
const proxyConfig: Record<string, Proxy> = {
    openai: new OpenAIProxy(),
    openrouter: new OpenRouterProxy(),
    anthropic: new AnthropicProxy(),
    gemini: new GeminiProxy(),
    moonshot: new CommonProxy("https://api.moonshot.cn", "MOONSHOT_API_KEY"),
};

app.use(
    "*",
    cors({
        origin: "*",
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
    })
);

app.get("/health", async (c) => {
    const { colo, loc } = await getWorkerLocation();
    return c.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        loc: loc,
        colo: colo,
    });
});

// Generic proxy handler function
const createProxyHandler = (pathPrefix: string, proxy: Proxy) => {
    return async (c: Context<{ Bindings: Env }>) => {
        try {
            const url = new URL(c.req.url);
            const path = handlePath(url, pathPrefix);
            return proxy.proxyRequest(c, path, await useDOStubCall());
        } catch (error) {
            console.error(`Error in ${pathPrefix} proxy request:`, error);
            return c.json({ error: "Internal server error" }, 500);
        }
    };
};

// Automatically register all proxy routes
Object.entries(proxyConfig).forEach(([pathPrefix, proxy]) => {
    app.post(`/${pathPrefix}/*`, createProxyHandler(pathPrefix, proxy));
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
