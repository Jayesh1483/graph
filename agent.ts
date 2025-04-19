import { HumanMessage } from "@langchain/core/messages";
import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { AgentController } from "./controllers/agentController";
import "dotenv/config";
import { v4 as uuidv4 } from 'uuid';
import { logger } from "./utils/logger";

export async function callAgent(
  client: MongoClient,
  query: string,
  thread_id: string
) {
  // Validate environment variables
  AgentController.validateEnvironment();

  // Create workflow
  const workflow = await AgentController.createWorkflow();

  // Initialize MongoDB checkpointer
  const checkpointer = new MongoDBSaver({
    client,
    dbName: process.env.DB_NAME as string,
  });

  // Compile the workflow
  const app = workflow.compile({ checkpointer });

  // Execute the workflow
  const finalState = await app.invoke(
    {
      messages: [new HumanMessage(query)],
    },
    { recursionLimit: 15, configurable: { thread_id: thread_id } }
  );

  const finalMessage =
    finalState.messages[finalState.messages.length - 1].content;
  logger.info(`Agent response for thread ${thread_id}:`, { finalMessage });

  return finalMessage;
}

export async function runScheduledAgentTask(client: MongoClient, taskDescription: string) {
  const thread_id = `scheduled_task_${uuidv4()}`;
  logger.info(`Starting scheduled agent task: ${taskDescription}`, { thread_id });

  try {
    AgentController.validateEnvironment();
    const workflow = await AgentController.createWorkflow();
    const checkpointer = new MongoDBSaver({
      client,
      dbName: process.env.DB_NAME as string,
    });
    const app = workflow.compile({ checkpointer });

    const finalState = await app.invoke(
      {
        messages: [new HumanMessage(taskDescription)],
      },
      {
        recursionLimit: 25,
        configurable: { thread_id: thread_id },
      }
    );

    const finalMessage = finalState.messages[finalState.messages.length - 1]?.content ?? "No final message content.";
    logger.info(`Scheduled agent task completed for thread ${thread_id}:`, { finalMessage });

    return finalMessage;
  } catch (error) {
    logger.error(`Error running scheduled agent task for thread ${thread_id}:`, { error });
    if (error instanceof Error && error.message.includes("Recursion limit")) {
        logger.error(`Scheduled task ${thread_id} hit recursion limit.`, { error });
        return `Error: Agent process exceeded the step limit (${25}) during scheduled task ${thread_id}.`;
     }
    return `Error during scheduled task: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
