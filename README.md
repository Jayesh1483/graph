# AsyncGraph
<div align="center">
  <img src="./assets/ASYNC.png" alt="AsyncGraph Logo" width="100%" />
</div>

AsyncGraph is an advanced multi-agent development framework built with TypeScript, designed to create, deploy, and manage autonomous AI agents. It offers a flexible and extensible platform for developing intelligent agents that operate independently, adapt to dynamic environments, and optimize their performance in real-time.

## About the Project

AsyncGraph empowers developers with:

- **Modular Architecture**: Easy integration and customization for specific use cases
- **Reasoning and Response Capability**: Transparent decision-making process
- **Knowledge and Learning Capabilities**: Continuous learning from interactions
- **Economic Efficiency**: 10x-15x cost reduction compared to other frameworks
- **Transaction Execution Support**: Handles both on-chain and off-chain transactions

### Why TypeScript?

TypeScript provides:

- Robust type safety
- Extensive library support
- Seamless integration capabilities
- Strong developer tooling
- Excellent scalability for complex applications

## Products You Can Build

AsyncGraph enables the development of various autonomous agents:

### DeFi Applications

- Autonomous trading bots
- Yield optimizers
- Arbitrage agents
- Swapping agents
- Bridging agents for cross-chain operations

### Security & Management

- Security monitoring agents
- Contract auditing agents
- Automated contract management tools
- Real-time threat detection systems

### Community & Gaming

- Community engagement bots
- Gaming AI agents
- Interactive gameplay assistants
- Social AI moderators

### Betting & Analytics

- Decentralized betting agents
- Market analysis tools
- Risk assessment systems

### Prerequisites

- Node.js (v18 or higher)
- TypeScript (v4.5 or higher)

## Installation

```bash
# Install using npm
npm install

# Or using yarn
yarn
```

## Environment Variables

Create a `.env` file in the root directory with the following configurations:

```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
MONGODB_URI=
DB_NAME=
```

## Start the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run start
```

## Integrating New Tools

AsyncGraph provides a flexible plugin system for integrating new tools:

1. **Create Tool**

Create a new file in the `tools` folder with the following structure:

```typescript
import { tool } from "@langchain/core/tools";

export const CustomTool = tool(
  async ({ query }: { query: string }) => {
    // Tool implementation
  },
  {
    name: "custom-tool",
    description: "Description of your tool",
  }
);
```

2. **Export Tool**

Export the tool from the file:

export the tool in the `tools` folder in the `index.ts` file

### Tool Integration Guidelines

- Ensure your tool implements the required interfaces
- Include comprehensive error handling
- Add appropriate type definitions
- Document tool capabilities and parameters
- Include usage examples

### CURL Example For Testing

## New Query

```bash
curl -X POST \
  http://localhost:3000/api/agent/query \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "what is the weather in dubai"
  }'
```

## Response

```bash
{
  {"success":true,"data":"The current weather in Dubai is clear with a temperature of 26.3°C (79.3°F). The wind is coming from the WNW at a speed of 7.6 kph (4.7 mph). The humidity is at 45%.","threadId":"thread_c4fa6585-397d-46c0-ae04-cb4da4102dd7"}
}
```

## Continue The Conversation

```bash
curl -X POST \
  http://localhost:3000/api/agent/query \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "what about india",
"threadId": "thread_c4fa6585-397d-46c0-ae04-cb4da4102dd7"
  }'
```

## Response

```bash
{"success":true,"data":"The current weather in New Delhi, India is misty with a temperature of 21.2°C (70.2°F). The wind is coming from the West at a speed of 4.3 kph (2.7 mph). The humidity is at 46%.","threadId":"thread_c4fa6585-397d-46c0-ae04-cb4da4102dd7"}
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

[License details here](LICENSE)

## Support

For support, please [create an issue](https://github.com/yourusername/asyncgraph/issues) 
