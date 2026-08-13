import { json } from '../../_lib/helpers.js';
import { llmStatus } from '../../_lib/llm.js';

export function onRequestGet(context) {
  return json(llmStatus(context.env));
}
