import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContextStore {
  correlationId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

class RequestContext {
  public static run<T>(correlationId: string, callback: () => T): T {
    return storage.run({ correlationId }, callback);
  }

  public static correlationId(): string | undefined {
    return storage.getStore()?.correlationId;
  }
}

export default RequestContext;
