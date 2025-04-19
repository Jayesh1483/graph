import { tool } from "@langchain/core/tools";
import { TwitterApi } from 'twitter-api-v2';
import { z } from "zod";
import "dotenv/config";
// TODO: Configure and import a proper logger instance if available
// import logger from '../utils/logger';

// Load credentials securely from environment variables
// Ensure these are set in your .env file
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

// Create a read/write client (needed for v2 POST requests like tweeting)
const rwClient = twitterClient.readWrite;

export const postTweetTool = tool(
  async ({ content }: { content: string }) => {
    // Validate credentials exist before attempting to tweet
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET || !process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_SECRET) {
      // logger?.error('Twitter API credentials missing in .env file.');
      return "Error: Twitter API credentials missing. Please configure them in the .env file.";
    }

    try {
      // Use the read/write client for v2 tweet endpoint
      const result = await rwClient.v2.tweet(content);
      // logger?.info('Tweet posted successfully:', { tweetId: result.data.id });
      return `Successfully posted tweet: ${result.data.text.substring(0, 50)}... (ID: ${result.data.id})`;
    } catch (error: any) {
      // logger?.error('Failed to post tweet:', error);
      // Provide more specific error feedback if possible
      const errorMessage = error.message || 'Unknown error';
      return `Error posting tweet: ${errorMessage}`;
    }
  },
  {
    name: "post_tweet",
    description: "Posts the provided text content as a tweet to the configured Twitter account. Requires Twitter API v2 credentials.",
    schema: z.object({
      content: z.string().max(280, { message: "Tweet content must be 280 characters or less." }).describe("The text content to be posted as a tweet (max 280 characters)."),
    }),
  }
); 