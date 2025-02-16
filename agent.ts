import { HumanMessage } from "@langchain/core/messages";
import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { AgentController } from "./controllers/agentController";
import "dotenv/config";

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
  console.log(finalMessage);

  return finalMessage;
}
