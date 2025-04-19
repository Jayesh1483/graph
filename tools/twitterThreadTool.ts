import { tool } from "@langchain/core/tools";
import { TwitterApi } from 'twitter-api-v2';
import { z } from "zod";
import "dotenv/config";
// TODO: Configure and import a proper logger instance if available
// import logger from '../utils/logger';

// Load credentials securely (ensure they are validated elsewhere, e.g., AgentController)
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

const rwClient = twitterClient.readWrite;

export const postThreadTool = tool(
  async ({ thread_parts }: { thread_parts: string[] }) => {
    if (!thread_parts || thread_parts.length === 0) {
      return "Error: No content provided for the thread.";
    }

    // Optional: Add validation for credentials here too if not done upstream
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET || !process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_SECRET) {
        return "Error: Twitter API credentials missing. Please configure them in the .env file.";
    }

    let previousTweetId: string | undefined = undefined;
    const postedTweetIds: string[] = [];

    try {
      for (let i = 0; i < thread_parts.length; i++) {
        const partContent = thread_parts[i];
        let result;

        if (i === 0) {
          // Post the first tweet normally
          result = await rwClient.v2.tweet(partContent);
          // logger?.info(`Posted first tweet of thread: ${result.data.id}`);
        } else if (previousTweetId) {
          // Reply to the previous tweet for subsequent parts
          result = await rwClient.v2.reply(partContent, previousTweetId);
          // logger?.info(`Posted reply tweet ${i + 1}/${thread_parts.length}: ${result.data.id}`);
        }

        if (result) {
          previousTweetId = result.data.id;
          postedTweetIds.push(result.data.id);
        } else {
          // Should not happen if logic is correct, but handle defensively
          throw new Error(`Failed to post part ${i + 1} of the thread.`);
        }

        // Optional: Add a small delay between posts if needed, though usually not required
        // await new Promise(resolve => setTimeout(resolve, 500));
      }

      return `Successfully posted thread with ${postedTweetIds.length} parts. First tweet ID: ${postedTweetIds[0]}`;

    } catch (error: any) {
      // logger?.error('Failed to post thread:', error);
      const errorMessage = error.message || 'Unknown error';
      // TODO: Consider deleting already posted parts of the thread on failure?
      return `Error posting thread (posted ${postedTweetIds.length} parts before failure): ${errorMessage}`;
    }
  },
  {
    name: "post_thread",
    description: "Posts the provided array of strings as a Twitter thread, replying sequentially. Requires Twitter API v2 credentials.",
    schema: z.object({
      thread_parts: z.array(z.string()
          // Optional: Add back max length validation if agent might still forget numbering/length
          // .max(280, { message: "Each thread part must be 280 characters or less." })
        )
        .min(1, { message: "Thread must contain at least one part." })
        .describe("An array of strings, where each string is one part of the thread content (ideally numbered like '1/n', '2/n'). Ensure each part respects Twitter limits."),
    }),
  }
); 