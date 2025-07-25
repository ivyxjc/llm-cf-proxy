# OpenAI Proxy - Cloudflare Worker

A lightweight OpenAI API proxy built with Hono framework and deployed on Cloudflare Workers.

## Features

- ✅ Proxy OpenAI Chat Completions API
- ✅ Proxy OpenAI Completions API  
- ✅ Proxy OpenAI Models API
- ✅ CORS support
- ✅ Error handling
- ✅ Health check endpoint

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

Example:
```javascript
const openai = new OpenAI({
  baseURL: 'https://your-worker.your-subdomain.workers.dev',
  apiKey: 'your-api-key'
});
```