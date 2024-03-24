import { inject, injectable } from "inversify";
import {
  SQSClient,
  ReceiveMessageCommand,
  Message,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { DailyCacheService } from "../daily_cache_service";
import TYPES from "../../types";
import {
  VolumeSurgeCandidate,
  VolumeSurgeCandidateSchema,
} from "./volume-surge-types";
import NodeCache = require("node-cache");
import { Volumes } from "aws-sdk/clients/batch";
const queueURL = "https://sqs.us-east-1.amazonaws.com/464570369687/VolumeSurge";

@injectable()
export class VolumeSurgeService {
  private sqsClient: SQSClient;
  private pollingInterval: number = 10000; // 5 seconds
  private cache: NodeCache;

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService
  ) {
    this.sqsClient = new SQSClient({ region: "us-east-1" });
    // Create the cache with a TTL of 2 minutes (120 seconds)
    this.cache = new NodeCache({ stdTTL: 120, checkperiod: 60 });
  }

  public async startPolling(): Promise<void> {
    const pollQueue = async () => {
      if (this.isWithinTimeWindow()) {
        try {
          const command = new ReceiveMessageCommand({
            QueueUrl: queueURL,
            MaxNumberOfMessages: 10,
          });
          const response = await this.sqsClient.send(command);

          if (response.Messages && response.Messages.length > 0) {
            for (const message of response.Messages) {
              await this.processMessage(message);
            }
          }
        } catch (error) {
          console.error("Error receiving messages from SQS:", error);
        }
      }

      // Schedule next polling
      setTimeout(pollQueue, this.pollingInterval);
    };

    // Start initial polling
    await pollQueue();
  }

  private isWithinTimeWindow(): boolean {
    const now = new Date();
    const start = new Date();
    start.setHours(8, 25, 0); // 8:30 am
    const end = new Date();
    end.setHours(23, 0, 0); // 5:00 pm
    return now >= start && now <= end;
  }

  async processMessage(message: Message): Promise<void> {
    if (!message || !message.Body) {
      console.error("Cannot process an empty message");
      return;
    }

    const messageId = message.MessageId;
    if (this.cache.has(messageId!)) {
      console.log(
        `Message with ID ${messageId} has already been processed. Skipping.`
      );
      return;
    }

    try {
      // Parse the message body as JSON and validate it against the Zod schema
      const parsedMessage = VolumeSurgeCandidateSchema.parse(
        JSON.parse(message.Body)
      );

      // Process the parsed message here
      console.log("Received message:", parsedMessage);

      // Cache the parsed message
      this.cache.set(message.MessageId!, parsedMessage);

      // Delete the message from the queue after processing (optional)
      if (message.ReceiptHandle) {
        await this.deleteMessage(message.ReceiptHandle);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }

    // Delete the message from the queue after processing (optional)
    if (message.ReceiptHandle) {
      await this.deleteMessage(message.ReceiptHandle);
    }
  }

  // Optional: Implement a method to delete a message from the queue
  async deleteMessage(receiptHandle: string): Promise<void> {
    console.log(`attempting to delete ${receiptHandle}`);
    try {
      const deleteCommand = new DeleteMessageCommand({
        QueueUrl: queueURL,
        ReceiptHandle: receiptHandle,
      });
      await this.sqsClient.send(deleteCommand);
    } catch (error) {
      console.error("Error deleting message from SQS:", error);
      // Handle the error appropriately, e.g., retry, log, or notify
    }
  }

  public getCurrentVolumeSurgeCandidates(): VolumeSurgeCandidate[] {
    const values = this.cache.keys().map((key) => this.cache.get(key));

    return values as VolumeSurgeCandidate[];
  }
}
