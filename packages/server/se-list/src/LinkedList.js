/**
 * LinkedList Base Class
 * Provides core linked list functionality that can be composed into other classes
 */

import logger from "@buydy/se-logger";

export class LinkedList {
  constructor() {
    this.nodes = new Map();
    this.executionOrder = [];
    this.currentNodeIndex = 0;
  }

  /**
   * Add a node to the linked list
   */
  addNode(nodeId, nodeData) {
    this.nodes.set(nodeId, {
      id: nodeId,
      ...nodeData,
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      cancelled: false,
    });

    this.executionOrder.push(nodeId);
    logger.business(`➕ Added node ${nodeId} to linked list`);
  }

  /**
   * Get the current node
   */
  getCurrentNode() {
    if (this.currentNodeIndex >= this.executionOrder.length) {
      return null;
    }

    const nodeId = this.executionOrder[this.currentNodeIndex];
    return this.nodes.get(nodeId);
  }

  /**
   * Get the next node to execute
   */
  getNextNode() {
    if (this.currentNodeIndex >= this.executionOrder.length) {
      return null; // List completed
    }

    const nodeId = this.executionOrder[this.currentNodeIndex];
    return this.nodes.get(nodeId);
  }

  /**
   * Update the status of a specific node
   */
  updateNodeStatus(nodeId, status) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = status;
      if (status === "running") {
        node.startedAt = new Date();
        node.cancelled = false; // Reset cancellation flag when starting
      }
    }
  }

  /**
   * Cancel a specific node
   */
  cancelNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.cancelled = true;
      node.status = "cancelled";
      logger.business(`🛑 Node ${nodeId} cancelled`);
    }
  }

  /**
   * Check if a node is cancelled
   */
  isNodeCancelled(nodeId) {
    const node = this.nodes.get(nodeId);
    return node ? node.cancelled : false;
  }

  /**
   * Mark current node as completed and move to next
   */
  completeCurrentNode(result = null) {
    if (this.currentNodeIndex < this.executionOrder.length) {
      const nodeId = this.executionOrder[this.currentNodeIndex];
      const node = this.nodes.get(nodeId);

      if (node) {
        node.status = "completed";
        node.result = result;
        node.completedAt = new Date();
        logger.business(`✅ Node ${nodeId} completed`);
      }

      this.currentNodeIndex++;
    }
  }

  /**
   * Mark current node as failed
   */
  failCurrentNode(error) {
    if (this.currentNodeIndex < this.executionOrder.length) {
      const nodeId = this.executionOrder[this.currentNodeIndex];
      const node = this.nodes.get(nodeId);

      if (node) {
        node.status = "failed";
        node.error = error;
        node.failedAt = new Date();
        node.attempts++;
        logger.business(`❌ Node ${nodeId} failed: ${error.message || error}`);
      }
    }
  }

  /**
   * Check if list is completed
   */
  isCompleted() {
    return this.currentNodeIndex >= this.executionOrder.length;
  }

  /**
   * Reset list to beginning
   */
  reset() {
    this.currentNodeIndex = 0;
    this.nodes.forEach((node) => {
      node.status = "pending";
      node.attempts = 0;
      node.cancelled = false;
      delete node.result;
      delete node.error;
      delete node.completedAt;
      delete node.failedAt;
    });
    logger.business(`🔄 Linked list reset to beginning`);
  }

  /**
   * Get execution status
   */
  getStatus() {
    const total = this.executionOrder.length;
    const completed = this.currentNodeIndex;
    const failed = Array.from(this.nodes.values()).filter(
      (node) => node.status === "failed"
    ).length;

    return {
      total,
      completed,
      failed,
      current: this.currentNodeIndex,
      progress: total > 0 ? (completed / total) * 100 : 0,
      isCompleted: this.isCompleted(),
    };
  }
}
