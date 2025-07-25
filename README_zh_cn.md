[English](README.md) | [简体中文](README_zh_cn.md)

---

# 🤖 LLM 代理 - Cloudflare Worker

基于 Hono 框架构建的高性能、轻量级多 LLM 提供商代理，部署在 Cloudflare Workers 上，提供全球边缘分发。

## ✨ 特性

- 🚀 **多提供商支持** - 支持 OpenAI、Anthropic 和 OpenRouter API
- 🌍 **全球边缘分发** - 部署在 Cloudflare Workers 上，低延迟访问
- 🎯 **真实区域请求** - 使用 Durable Objects 从指定区域的数据中心发出请求
- 📍 **区域合规性** - 确保数据处理符合特定地区的法规要求（GDPR 等）
- 🛡️ **CORS 支持** - 启用跨源资源共享
- 📊 **健康监控** - 内置健康检查端点
- ⚡ **快速轻量** - 最小开销，支持 TypeScript

## 🚀 快速开始

### 前置要求
- Node.js 20+
- pnpm
- 拥有 Workers 访问权限的 Cloudflare 账户

### 安装

1. **克隆仓库：**
```bash
git clone https://github.com/ivyxjc/llm-cf-proxy.git
cd llm-cf-proxy
```

2. **安装依赖：**
```bash
pnpm install
```

3. **配置 Cloudflare：**
```bash
# 登录 Cloudflare
npx wrangler login
```

4. **部署到 Cloudflare Workers：**
```bash
pnpm run deploy
```

## 🛠️ 开发

### 本地开发
```bash
# 启动开发服务器
pnpm run dev

# 运行测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm test -- --coverage
```

## 📡 API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查|
| `/openai/*` | POST | 代理到 OpenAI API |
| `/anthropic/*` | POST | 代理到 Anthropic API |
| `/openrouter/*` | POST | 代理到 OpenRouter API |

### 健康检查响应
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
}
```

## 🔧 使用方法

### OpenAI API
将 `https://api.openai.com` 替换为你的 Cloudflare Worker URL：

```javascript
// 之前
const openai = new OpenAI({
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'your-api-key'
});

// 之后
const openai = new OpenAI({
  baseURL: 'https://your-worker.your-subdomain.workers.dev/openai/v1',
  apiKey: 'your-api-key'
});
```

### Anthropic API
将 `https://api.anthropic.com` 替换为你的 Cloudflare Worker URL：

```javascript
// 之前
const anthropic = new Anthropic({
  baseURL: 'https://api.anthropic.com',
  apiKey: 'your-api-key'
});

// 之后
const anthropic = new Anthropic({
  baseURL: 'https://your-worker.your-subdomain.workers.dev/anthropic',
  apiKey: 'your-api-key'
});
```

### OpenRouter API
将 `https://openrouter.ai/api` 替换为你的 Cloudflare Worker URL：

```javascript
// 之前
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});

// 之后
const response = await fetch('https://your-worker.your-subdomain.workers.dev/openrouter/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

## 🌍 区域特定路由

### 工作原理

本代理使用 **Cloudflare Durable Objects** 实现智能的区域路由。系统会自动检测 Worker 的运行位置，并在特定情况下使用 Durable Object 来优化请求路径：

- **智能检测**：自动检测 Worker 的运行位置
- **条件路由**：当检测到特定地区（如中国、香港）时，自动使用 Durable Object 路由
- **性能优化**：通过区域特定的 DO 减少网络延迟和提高连接稳定性
- **透明代理**：对客户端完全透明，无需额外配置

### 技术实现

当前实现的路由逻辑：

1. **位置检测**：Worker 启动时检测自身运行的 Cloudflare 数据中心位置
2. **路由决策**：根据位置代码决定是否使用 Durable Object
3. **DO 实例化**：如需使用，创建位于西北美区域的 Durable Object 实例
4. **请求转发**：DO 在其所在区域直接向目标 API 发起请求

### 当前配置

系统会在以下情况自动启用 Durable Object 路由：

| 位置代码 | 地区 | DO 路由 | 目标区域 |
|---------|------|---------|---------|
| `HK` | 香港 | ✅ 启用 | 西北美 (`wnam`) |
| `CN` | 中国 | ✅ 启用 | 西北美 (`wnam`) |
| 其他 | 全球其他地区 | ❌ 直连 | - |

### 代码实现示例

#### 自动区域检测
```typescript
// 系统自动检测位置并决定路由策略
async function useDOStubCall() {
    const { loc, colo } = await getWorkerLocation();
    console.log(`The origin worker is at ${colo} from ${loc} ...`);
    
    // 只有在特定地区才使用 Durable Object
    if (loc === "HK" || loc === "CN") {
        return true;  // 使用 DO 路由
    }
    return false;     // 直接连接
}
```

#### 客户端使用
```javascript
// 客户端无需任何特殊配置，系统自动处理路由
const openai = new OpenAI({
  baseURL: 'https://your-worker.your-subdomain.workers.dev/openai/v1',
  apiKey: 'your-api-key'
});

// 请求会自动根据 Worker 位置选择最优路由
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello World!" }]
});
```

### 配置自定义区域路由

如果你想修改路由逻辑或添加更多区域支持，可以编辑 `src/util.ts` 文件：

```typescript
// 自定义区域检测逻辑
async function useDOStubCall() {
    const { loc, colo } = await getWorkerLocation();
    
    // 添加更多需要 DO 路由的地区
    const needsDORouting = ["HK", "CN", "SG", "JP"]; // 可根据需要添加
    
    return needsDORouting.includes(loc);
}
```

你也可以在 `src/proxy.ts` 中修改目标 DO 区域：

```typescript
// 修改 Durable Object 的目标区域
const doId = c.env.LLM_PROXY_DO.idFromName("eu");  // 改为欧洲区域
const doStub = c.env.LLM_PROXY_DO.get(doId, {
    locationHint: "weur" as DurableObjectLocationHint,  // 西欧
});
```

### 支持的 Cloudflare 位置提示

| 位置提示 | 区域 | 说明 |
|---------|------|------|
| `wnam` | 西北美 | 美国西海岸、加拿大西部 |
| `enam` | 东北美 | 美国东海岸、加拿大东部 |
| `weur` | 西欧 | 英国、法国、德国等 |
| `eeur` | 东欧 | 波兰、捷克等 |
| `apac` | 亚太 | 日本、新加坡、澳洲 |
| `oc` | 大洋洲 | 澳大利亚、新西兰 |
| `afr` | 非洲 | 南非等 |
| `sam` | 南美 | 巴西、阿根廷等 |

### 路由工作流程

代理的完整工作流程：

1. **请求接收**：Worker 接收来自客户端的请求
2. **位置检测**：自动检测当前 Worker 的运行位置
3. **路由决策**：根据预配置的规则决定是否使用 Durable Object
4. **请求处理**：
   - 如果使用 DO：创建 DO 实例并转发请求
   - 如果直连：直接向目标 API 发起请求
5. **响应返回**：将 API 响应返回给客户端
6. **资源清理**：自动清理 DO 实例（如有使用）

### 监控和调试

你可以通过健康检查端点查看当前 Worker 的位置信息：

```bash
curl https://your-worker.your-subdomain.workers.dev/health
```

响应示例：
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "loc": "HK",           // 位置代码
  "colo": "HKG"          // 数据中心代码
}
```

通过日志也可以查看路由决策：
- `Using Durable Object for proxy request ...` - 表示使用了 DO 路由
- `The origin worker is at {colo} from {loc} ...` - 显示 Worker 位置信息

## 🔧 配置

### 持久化对象
项目使用 Cloudflare 持久化对象进行区域特定路由。配置文件位于 `wrangler.toml`。

## 🤝 贡献

1. Fork 这个仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 📄 许可证

这个项目使用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Hono](https://hono.dev/) - 轻量级 Web 框架
- [Cloudflare Workers](https://workers.cloudflare.com/) - 边缘计算平台
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) - 有状态的无服务器对象