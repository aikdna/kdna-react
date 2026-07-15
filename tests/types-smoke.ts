import {
  parseTrace,
  useTrace,
  validateTrace,
  type JudgmentTrace,
  type TraceView,
} from "../src/index.js";

declare const trace: JudgmentTrace;
const parsed: JudgmentTrace = parseTrace(JSON.stringify(trace));
const view: TraceView = useTrace(parsed);
const validation: { valid: boolean; errors: string[] } = validateTrace(parsed);

void view;
void validation;
