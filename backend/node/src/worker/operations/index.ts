export interface OperationContext {
  getFile: (key: string) => Promise<Buffer>;
  putFile: (key: string, buffer: Buffer, contentType: string) => Promise<void>;
  updateStatus: (jobId: string, status: string, data?: any) => Promise<void>;
  reportProgress: (percent: number) => void;
}

export interface OperationResult {
  outputKey: string;
  contentType: string;
}

export type OperationHandler = (
  jobId: string,
  metadata: Record<string, any>,
  ctx: OperationContext
) => Promise<OperationResult | null>;

import { convertHandlers } from "./convert";
import { transformHandlers } from "./transform";
import { mergeSplitHandlers } from "./merge-split";
import { imageHandlers } from "./image";
import { extractHandlers } from "./extract";

const registry: Record<string, OperationHandler> = {
  ...convertHandlers,
  ...transformHandlers,
  ...mergeSplitHandlers,
  ...imageHandlers,
  ...extractHandlers,
};

export function getOperationHandler(type: string): OperationHandler | undefined {
  return registry[type];
}
