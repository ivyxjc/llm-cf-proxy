# OpenAI Proxy - Cloudflare Worker

A lightweight OpenAI API proxy built with Hono framework and deployed on Cloudflare Workers.

## Features

- ✅ Proxy OpenAI Chat Completions API
- ✅ Proxy OpenAI Completions API  
- ✅ Proxy OpenAI Models API
- ✅ CORS support
- ✅ Error handling
- ✅ Health check endpoint
- ✅ **Region-specific requests via Durable Objects**

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set your OpenAI API key as a secret:
```bash
wrangler secret put OPENAI_API_KEY
```

3. Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Development

Run locally:
```bash
npm run dev
```

## API Endpoints

- `GET /` - API information
- `GET /health` - Health check
- `POST /v1/chat/completions` - OpenAI Chat Completions
- `POST /v1/completions` - OpenAI Completions
- `GET /v1/models` - OpenAI Models

## Usage

Replace `https://api.openai.com` with your worker URL in your OpenAI client configuration.

### Basic Usage
```javascript
const openai = new OpenAI({
  baseURL: 'https://your-worker.your-subdomain.workers.dev',
  apiKey: 'your-api-key'
});
```

### Region-Specific Requests
You can specify the region where the request should originate from using query parameters or headers:

**Using query parameter:**
```javascript
const openai = new OpenAI({
  baseURL: 'https://your-worker.your-subdomain.workers.dev',
  apiKey: 'your-api-key'
});

// The region parameter will be automatically appended to requests
await openai.chat.completions.create({
  // your request parameters
}, {
  query: { region: 'eu' }  // Available regions: us, eu, ap, etc.
});
```

**Using custom headers:**
```javascript
const openai = new OpenAI({
  baseURL: 'https://your-worker.your-subdomain.workers.dev',
  apiKey: 'your-api-key',
  defaultHeaders: {
    'X-Region': 'eu'  // Specify region via header
  }
});
```

**Available regions:**
- `us` - United States (default)
- `eu` - Europe  
- `ap` - Asia Pacific
- `oc` - Oceania
- `af` - Africa
- `sa` - South America

The proxy will create a Durable Object in the specified region to make the actual OpenAI API request, ensuring optimal latency and compliance with regional requirements.