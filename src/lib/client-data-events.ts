type DataChangeListener = () => void;

const listeners = new Set<DataChangeListener>();

export function notifyDataChange() {
  listeners.forEach((listener) => listener());
}

export function subscribeToDataChanges(listener: DataChangeListener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
