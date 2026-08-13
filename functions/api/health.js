import { json } from '../_lib/helpers.js';

export function onRequest() {
  return json({ ok: true });
}
