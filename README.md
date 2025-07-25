[简体中文](README_zh_cn.md) | [English](README.md)

---

# 🤖 LLM Proxy - Cloudflare Worker

A high-performance, lightweight proxy for multiple LLM providers built with Hono framework and deployed on Cloudflare Workers with global edge distribution.

## ✨ Features

- 🚀 **Multi-Provider Support** - OpenAI, Anthropic, and OpenRouter APIs
- 🌍 **Global Edge Distribution** - Deployed on Cloudflare Workers for low latency
- 🎯 **True Regional Requests** - Use Durable Objects to make requests from specific data centers
- 📍 **Regional Compliance** - Ensure data processing complies with regional regulations (GDPR, etc.)
- 🛡️ **CORS Support** - Cross-origin resource sharing enabled
- 📊 **Health Monitoring** - Built-in health check endpoints
- ⚡ **Fast & Lightweight** - Minimal overhead with TypeScript support

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm
- Cloudflare account with Workers access

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/ivyxjc/llm-cf-proxy.git
cd llm-cf-proxy
```

2. **Install dependencies:**
```bash
pnpm install
```

3. **Configure Cloudflare:**
```bash
# Login to Cloudflare
npx wrangler login
```

4. **Deploy to Cloudflare Workers:**
```bash
pnpm run deploy
```

## 🛠️ Development

### Local Development
```bash
# Start development server
pnpm run dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage

```

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/openai/*` | POST | Proxy to OpenAI API |
| `/anthropic/*` | POST | Proxy to Anthropic API |
| `/openrouter/*` | POST | Proxy to OpenRouter API |

### Health Check Response
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
}
```

## 🔧 Usage

### OpenAI API
Replace `https://api.openai.com` with your Cloudflare Worker URL:

```javascript
// Before
const openai = new OpenAI({
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'your-api-key'
});

// After
const openai = new OpenAI({
  baseURL: 'https://your-worker.your-subdomain.workers.dev/openai/v1',
  apiKey: 'your-api-key'
});
```

### Anthropic API
Replace `https://api.anthropic.com` with your Cloudflare Worker URL:

```javascript
// Before
const anthropic = new Anthropic({
  baseURL: 'https://api.anthropic.com',
  apiKey: 'your-api-key'
});

// After
const anthropic = new Anthropic({
  baseURL: 'https://your-worker.your-subdomain.workers.dev/anthropic',
  apiKey: 'your-api-key'
});
```

### OpenRouter API
Replace `https://openrouter.ai/api` with your Cloudflare Worker URL:

```javascript
// Before
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});

// After
const response = await fetch('https://your-worker.your-subdomain.workers.dev/openrouter/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

## 🌍 Region-Specific Routing

### How It Works

This proxy uses **Cloudflare Durable Objects** to implement intelligent regional routing. The system automatically detects the Worker's running location and uses Durable Objects in specific scenarios to optimize request paths:

- **Smart Detection**: Automatically detects Worker's running location
- **Conditional Routing**: Automatically uses Durable Object routing when specific regions (China, Hong Kong) are detected
- **Performance Optimization**: Reduces network latency and improves connection stability through region-specific DOs
- **Transparent Proxy**: Completely transparent to clients, no additional configuration required

### Technical Implementation

Current routing logic:

1. **Location Detection**: Worker detects its Cloudflare data center location on startup
2. **Routing Decision**: Decides whether to use Durable Object based on location code
3. **DO Instantiation**: Creates DO instance in Western North America region if needed
4. **Request Forwarding**: DO makes direct requests to target APIs from its region

### Current Configuration

The system automatically enables Durable Object routing in the following cases:

| Location Code | Region | DO Routing | Target Region |
|---------------|--------|------------|---------------|
| `HK` | Hong Kong | ✅ Enabled | Western North America (`wnam`) |
| `CN` | China | ✅ Enabled | Western North America (`wnam`) |
| Others | Global | ❌ Direct | - |

### Code Implementation Examples

#### Automatic Region Detection
```typescript
// System automatically detects location and decides routing strategy
async function useDOStubCall() {
    const { loc, colo } = await getWorkerLocation();
    console.log(`The origin worker is at ${colo} from ${loc} ...`);
    
    // Only use Durable Object in specific regions
    if (loc === "HK" || loc === "CN") {
        return true;  // Use DO routing
    }
    return false;     // Direct connection
}
```

#### Client Usage
```javascript
// Client requires no special configuration, system handles routing automatically
const openai = new OpenAI({
  baseURL: 'https://your-worker.your-subdomain.workers.dev/openai/v1',
  apiKey: 'your-api-key'
});

// Requests automatically use optimal routing based on Worker location
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello World!" }]
});
```

### Configuring Custom Regional Routing

If you want to modify the routing logic or add more regional support, you can edit the `src/util.ts` file:

```typescript
// Custom region detection logic
async function useDOStubCall() {
    const { loc, colo } = await getWorkerLocation();
    
    // Add more regions that need DO routing
    const needsDORouting = ["HK", "CN", "SG", "JP"]; // Add as needed
    
    return needsDORouting.includes(loc);
}
```

You can also modify the target DO region in `src/proxy.ts`:

```typescript
// Modify Durable Object target region
const doId = c.env.LLM_PROXY_DO.idFromName("eu");  // Change to Europe region
const doStub = c.env.LLM_PROXY_DO.get(doId, {
    locationHint: "weur" as DurableObjectLocationHint,  // Western Europe
});
```

### Supported Cloudflare Location Hints

| Location Hint | Region | Description |
|---------------|--------|-------------|
| `wnam` | Western North America | US West Coast, Western Canada |
| `enam` | Eastern North America | US East Coast, Eastern Canada |
| `weur` | Western Europe | UK, France, Germany, etc. |
| `eeur` | Eastern Europe | Poland, Czech Republic, etc. |
| `apac` | Asia Pacific | Japan, Singapore, Australia |
| `oc` | Oceania | Australia, New Zealand |
| `afr` | Africa | South Africa, etc. |
| `sam` | South America | Brazil, Argentina, etc. |

### Routing Workflow

Complete proxy workflow:

1. **Request Reception**: Worker receives client request
2. **Location Detection**: Automatically detects current Worker's running location
3. **Routing Decision**: Decides whether to use Durable Object based on preconfigured rules
4. **Request Processing**:
   - If using DO: Creates DO instance and forwards request
   - If direct: Makes direct request to target API
5. **Response Relay**: Returns API response to client
6. **Resource Cleanup**: Automatically cleans up DO instance (if used)

### Monitoring and Debugging

You can check current Worker location information through the health check endpoint:

```bash
curl https://your-worker.your-subdomain.workers.dev/health
```

Example response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "loc": "HK",           // Location code
  "colo": "HKG"          // Data center code
}
```

You can also view routing decisions through logs:
- `Using Durable Object for proxy request ...` - Indicates DO routing was used
- `The origin worker is at {colo} from {loc} ...` - Shows Worker location information

## 🔧 Configuration

### Durable Objects
The project uses Cloudflare Durable Objects for region-specific routing. Configuration is in `wrangler.toml`.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Hono](https://hono.dev/) - Lightweight web framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing platform
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) - Stateful serverless objects

