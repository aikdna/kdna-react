import {
  parseTrace,
  useTrace,
  validateTrace,
  type Trace,
  type TraceView,
} from "@aikdna/kdna-react";

declare const trace: Trace;
const parsed: Trace = parseTrace(JSON.stringify(trace));
const view: TraceView = useTrace(parsed);
const validation: { valid: boolean; errors: string[] } = validateTrace(parsed);

void view;
void validation;
