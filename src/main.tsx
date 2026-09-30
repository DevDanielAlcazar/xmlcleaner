import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Patch DOM methods to prevent React crashes caused by browser translation extensions (e.g. Edge Translate, Google Translate)
if (typeof Node !== 'undefined' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    try {
      if (child && child.parentNode === this) {
        return originalRemoveChild.call(this, child) as T;
      }
      if (child && child.parentNode) {
        return child.parentNode.removeChild(child) as T;
      }
    } catch (e) {
      // Suppress DOM removal crash
    }
    return child;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    try {
      if (referenceNode && referenceNode.parentNode === this) {
        return originalInsertBefore.call(this, newNode, referenceNode) as T;
      }
      if (referenceNode && referenceNode.parentNode) {
        return referenceNode.parentNode.insertBefore(newNode, referenceNode) as T;
      }
      return this.appendChild(newNode) as T;
    } catch (e) {
      try {
        return this.appendChild(newNode) as T;
      } catch (err) {
        return newNode;
      }
    }
  };

  const originalReplaceChild = Node.prototype.replaceChild;
  if (originalReplaceChild) {
    Node.prototype.replaceChild = function <T extends Node>(newChild: Node, oldChild: T): T {
      try {
        if (oldChild && oldChild.parentNode === this) {
          return originalReplaceChild.call(this, newChild, oldChild) as T;
        }
        if (oldChild && oldChild.parentNode) {
          return oldChild.parentNode.replaceChild(newChild, oldChild) as T;
        }
      } catch (e) {}
      return oldChild;
    };
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    const msg = (e && e.message) ? String(e.message) : '';
    if (
      msg.includes('removeChild') ||
      msg.includes('insertBefore') ||
      msg.includes('not a child of this node')
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
