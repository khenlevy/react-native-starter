/**
 * @buydy/se-list
 * Cycled Linked List Manager - Singleton for endless async function execution
 */

import { CycledLinkedList } from "./CycledLinkedList.js";

export { CycledLinkedList } from "./CycledLinkedList.js";
export { LinkedList } from "./LinkedList.js";

// Convenience function to get the singleton instance
export const getCycledList = () => CycledLinkedList.getInstance();
