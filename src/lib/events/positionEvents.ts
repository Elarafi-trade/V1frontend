/**
 * Global event emitter for position updates
 * Allows components to communicate without prop drilling
 */

type PositionEventListener = (position: any) => void;

class PositionEventEmitter {
  private listeners: Set<PositionEventListener> = new Set();

  subscribe(listener: PositionEventListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(position: any) {
    this.listeners.forEach(listener => {
      try {
        listener(position);
      } catch (error) {
        console.error('Error in position event listener:', error);
      }
    });
  }
}

export const positionEvents = new PositionEventEmitter();

