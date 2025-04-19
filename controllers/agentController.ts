import { BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, END } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import * as tools from "../tools";
import { AppError } from "../utils/errorHandler";
import { logger } from "../utils/logger";
import {
  web3AssistantPrompt,
  web3AssistantSystemMessage,
} from "../characters/web3Assistant";
import {
  twitterBotPrompt,
  twitterBotSystemMessage,
} from "../characters/twitterBot";
import * as crypto from 'crypto';

// Maximum number of recent post hashes to store for duplicate checking
const MAX_RECENT_POST_HASHES = 50; // Adjust as needed

// Helper function to create a simple hash of content
function createContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Graph state type definition for the AI agent
 */
export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  // Switched back to tracking hashes of posted content
  recent_post_hashes: Annotation<string[]>({
    reducer: (x = [], y) => y,
    default: () => [],
  }),
});

export class AgentController {
  /**
   * Determines if the agent should continue processing or return results.
   * Now explicitly ends after a successful tool call.
   */
  private static shouldContinue(state: typeof GraphState.State): "tools" | typeof END {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1]; // Get the actual last message

    // If the last message is a ToolMessage (result of tool call), end the process.
    // (We might refine this later if multi-tool calls per run are needed)
    if (lastMessage instanceof ToolMessage) {
        logger.debug("shouldContinue: Ending after ToolMessage.");
        return END;
    }

    // If the last message is an AIMessage *without* tool calls, end.
    if (lastMessage instanceof AIMessage && (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0)) {
        logger.debug("shouldContinue: Ending after AIMessage with no tool calls.");
        return END;
    }

    // If the last message is an AIMessage *with* tool calls, continue to tools.
    if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        logger.debug("shouldContinue: Continuing to tools node.");
        return "tools";
    }
    
    // Default case (e.g., after HumanMessage) - should ideally go to agent, but graph handles __start__
    // If we reach here unexpectedly, ending might be safest.
    logger.warn("shouldContinue: Reached unexpected state, ending.", { lastMessage });
    return END; 
  }

  /**
   * Processes a single model call within the agent workflow
   * Includes duplicate check (based on content hash) before returning tool call.
   */
  private static async callModel(state: typeof GraphState.State) {
    logger.debug("Entering callModel node", { state });
    try {
      const availableTools = Object.values(tools);
      const model = new ChatOpenAI({
        modelName: "gpt-4",
        temperature: 0.2,
      }).bindTools(availableTools);

      const messagesForModel = [
        new SystemMessage(twitterBotSystemMessage),
        ...state.messages
      ];

      const result = await model.invoke(messagesForModel);
      logger.debug("Model invocation result:", { result });

      // *** Duplicate Check Logic (Content Hash) ***
      if (result.tool_calls && result.tool_calls.length > 0) {
        const toolCall = result.tool_calls[0];
        let contentToCheck: string | undefined;
        let contentHash: string | undefined;

        if (toolCall.name === 'post_tweet' && toolCall.args?.content) {
          contentToCheck = toolCall.args.content as string;
        } else if (toolCall.name === 'post_thread' && Array.isArray(toolCall.args?.thread_parts) && toolCall.args.thread_parts.length > 0) {
          // For threads, use the first part for duplicate checking
          contentToCheck = toolCall.args.thread_parts[0] as string;
        }

        if (contentToCheck) {
          contentHash = createContentHash(contentToCheck);
          if (state.recent_post_hashes?.includes(contentHash)) {
            logger.warn("Duplicate content hash detected. Skipping post.", { hash: contentHash });
            return {
              messages: [new AIMessage("Generated content is identical to a recent post. Skipping this cycle.")]
            };
          }
        }
      }
      // *** End Duplicate Check Logic ***

      return { messages: [result] };
    } catch (error) {
      logger.error("Error in model call", { error });
      throw new AppError("Failed to process model call", 500);
    }
  }

  /**
   * Updates the recent_post_hashes state after a successful post/thread tool call.
   */
  private static updatePostedContentState(state: typeof GraphState.State): Partial<typeof GraphState.State> { // Renamed function
    logger.debug("Entering updatePostedContentState node", { state });
    const lastMessage = state.messages[state.messages.length - 1];
    let postedContentForHash: string | undefined;

    // Check if the last message is a ToolMessage indicating success for post_tweet or post_thread
    if (lastMessage instanceof ToolMessage && typeof lastMessage.content === 'string' && !lastMessage.content.toLowerCase().startsWith('error')) {
      const aiMessageIndex = state.messages.length - 2;
      if (aiMessageIndex >= 0 && state.messages[aiMessageIndex] instanceof AIMessage) {
        const aiMessage = state.messages[aiMessageIndex] as AIMessage;
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          const toolCall = aiMessage.tool_calls[0];
          // Extract content (or first part) to hash
          if (toolCall.name === 'post_tweet' && toolCall.args?.content) {
            postedContentForHash = toolCall.args.content as string;
          } else if (toolCall.name === 'post_thread' && Array.isArray(toolCall.args?.thread_parts) && toolCall.args.thread_parts.length > 0) {
            postedContentForHash = toolCall.args.thread_parts[0] as string;
          }
        }
      }
    }

    if (postedContentForHash) {
      const contentHash = createContentHash(postedContentForHash);
      const currentRecentHashes = state.recent_post_hashes ?? [];
      // Add new hash to the beginning, keep only the last MAX_RECENT_POST_HASHES
      const updatedRecentHashes = [contentHash, ...currentRecentHashes].slice(0, MAX_RECENT_POST_HASHES);
      logger.debug("Updating recent post hashes state", { newHash: contentHash });
      return { recent_post_hashes: updatedRecentHashes }; // Update the correct state field
    }

    logger.debug("No successful post detected or content extraction failed. No state update.");
    return {};
  }

  /**
   * Creates and configures the agent workflow
   */
  public static async createWorkflow() {
    try {
      const availableTools = Object.values(tools);
      const toolNode = new ToolNode<typeof GraphState.State>(availableTools);

      return new StateGraph(GraphState)
        .addNode("agent", this.callModel)
        .addNode("tools", toolNode)
        .addNode("update_state", this.updatePostedContentState) // Use new function name
        .addEdge("__start__", "agent")
        .addConditionalEdges("agent", this.shouldContinue)
        .addEdge("tools", "update_state")
        .addEdge("update_state", "agent");
    } catch (error) {
      logger.error("Error creating workflow", { error });
      throw new AppError("Failed to create agent workflow", 500);
    }
  }

  /**
   * Validates required environment variables
   */
  public static validateEnvironment() {
    const requiredEnvVars = [
      "DB_NAME",
      "OPENAI_API_KEY",
      "TAVILY_API_KEY",
      "TWITTER_API_KEY",
      "TWITTER_API_SECRET",
      "TWITTER_ACCESS_TOKEN",
      "TWITTER_ACCESS_SECRET",
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        logger.error(`Missing environment variable: ${envVar}`);
        throw new AppError(
          `${envVar} is not defined in environment variables`,
          500
        );
      }
    }
  }

  /**
   * Processes a user query through the AI agent
   * @param query The user's input query
   * @param threadId The conversation thread ID
   * @returns The agent's response
   */
  public static async processQuery(query: string, threadId: string) {
    try {
      this.validateEnvironment();

      const client = await MongoClient.connect(
        process.env.MONGODB_URI as string
      );
      const workflow = await this.createWorkflow();

      const checkpointer = new MongoDBSaver({
        client,
        dbName: process.env.DB_NAME as string,
      });

      const app = workflow.compile({ checkpointer });

      const finalState = await app.invoke(
        {
          messages: [new HumanMessage(query)],
        },
        {
          recursionLimit: 25,
          configurable: { thread_id: threadId },
        }
      );

      const finalMessage =
        finalState.messages[finalState.messages.length - 1].content;

      await client.close();
      return finalMessage;
    } catch (error) {
      logger.error("Error processing query", { error, threadId });
      if (error instanceof Error && error.message.includes("Recursion limit")) {
        logger.error("Graph execution hit recursion limit.", { query, threadId, error });
        return `Error: Agent process exceeded the step limit (${25}). It might be stuck in a loop (e.g., duplicate content generation).`;
      }
      throw error instanceof AppError
        ? error
        : new AppError("Failed to process query");
    }
  }
}
