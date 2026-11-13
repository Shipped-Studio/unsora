/*
 * Runs before the app becomes interactive.
 *
 * Browser translation (Chrome's auto-translate, Google Translate) swaps the
 * page's text nodes for its own <font> elements without React knowing. When
 * React later removes or moves one of those nodes, the DOM throws
 * "NotFoundError: Failed to execute 'removeChild' on 'Node'" and the whole
 * page falls to the error screen. That hit most visitors reading a translated
 * page (facebook/react#11538).
 *
 * Instead of turning translation off, which would leave those visitors with a
 * page they can't read, skip that one DOM change when the node has already
 * been moved. Nothing else changes: the guard only applies when the call
 * would have thrown.
 */
if (typeof Node === "function" && Node.prototype) {
  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      console.warn("Skipped removing a node another script moved (likely page translation).", child);
      return child;
    }
    return removeChild.call(this, child) as T;
  };

  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    node: T,
    reference: Node | null,
  ): T {
    if (reference && reference.parentNode !== this) {
      console.warn("Skipped inserting before a node another script moved (likely page translation).", reference);
      return node;
    }
    return insertBefore.call(this, node, reference) as T;
  };
}
