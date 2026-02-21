import { AsyncQueueManager } from "@buydy/dv-async-priority-queue";
import { getMaxConcurrentRequests } from "../config/concurrency.js";

// Singleton for the app-wide API priority queue
let apiPriorityQueueInstance = null;

export function getApiPriorityQueue() {
  if (!apiPriorityQueueInstance) {
    apiPriorityQueueInstance = new AsyncQueueManager({
      maxConcurrency: getMaxConcurrentRequests(),
      name: "ApiPriorityQueue",
      verbose: process.env.QUEUE_VERBOSE_LOGGING === "true",
    });
  }
  return apiPriorityQueueInstance;
}

export const apiPriorityQueue = getApiPriorityQueue();
