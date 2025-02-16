import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph } from "@langchain/langgraph";
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

/**
 * Graph state type definition for the AI agent
 */
export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

export class AgentController {
  /**
   * Determines if the agent should continue processing or return results
   */
  private static shouldContinue(state: typeof GraphState.State) {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    return lastMessage.tool_calls?.length ? "tools" : "__end__";
  }

  /**
   * Processes a single model call within the agent workflow
   */
  private static async callModel(state: typeof GraphState.State) {
    try {
      const availableTools = Object.values(tools);
      const model = new ChatOpenAI({
        modelName: "gpt-4",
        temperature: 0,
      }).bindTools(availableTools);

      const prompt = ChatPromptTemplate.fromMessages([
        ["system", web3AssistantPrompt],
        new MessagesPlaceholder("messages"),
      ]);

      const formattedPrompt = await prompt.formatMessages({
        system_message: web3AssistantSystemMessage,
        time: new Date().toISOString(),
        tool_names: availableTools.map((tool) => tool.name).join(", "),
        messages: state.messages,
      });

      const result = await model.invoke(formattedPrompt);
      return { messages: [result] };
    } catch (error) {
      logger.error("Error in model call", { error });
      throw new AppError("Failed to process model call", 500);
    }
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
        .addEdge("__start__", "agent")
        .addConditionalEdges("agent", this.shouldContinue)
        .addEdge("tools", "agent");
    } catch (error) {
      logger.error("Error creating workflow", { error });
      throw new AppError("Failed to create agent workflow", 500);
    }
  }

  /**
   * Validates required environment variables
   */
  public static validateEnvironment() {
    const requiredEnvVars = ["DB_NAME", "OPENAI_API_KEY"];

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
        { recursionLimit: 15, configurable: { thread_id: threadId } }
      );

      const finalMessage =
        finalState.messages[finalState.messages.length - 1].content;

      await client.close();
      return finalMessage;
    } catch (error) {
      logger.error("Error processing query", { error, threadId });
      throw error instanceof AppError
        ? error
        : new AppError("Failed to process query");
    }
  }
}
