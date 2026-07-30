import { reportAppError } from "./error-reporting";

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  reportAppError(error, context);
}
