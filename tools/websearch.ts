import { tool } from "@langchain/core/tools";
import { tavily } from "@tavily/core";
import "dotenv/config";
import { z } from "zod";
// Initialize Tavily search tool
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

export const webSearch = tool(
  async ({ query }: { query: string }) => {
    const response = await tvly.search(query, {
      num_results: 5,
    });
    return response;
  },
  {
    name: "web_search",
    description: "Search the web for current information",
    schema: z.object({
      query: z.string().describe("The search query to look up"),
    }),
  }
);
