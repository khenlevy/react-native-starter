/**
 * @buydy/se-list
 * Cycled Linked List Manager - Singleton for endless job execution
 */

import { CycledLinkedList } from "./src/CycledLinkedList.js";

export { CycledLinkedList } from "./src/CycledLinkedList.js";
export { LinkedList } from "./src/LinkedList.js";

// Convenience function to get the singleton instance
export const getCycledList = () => CycledLinkedList.getInstance();
