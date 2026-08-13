import { json } from '../../_lib/helpers.js';
import { clearAuthCookie } from '../../_lib/auth.js';

export function onRequestPost() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearAuthCookie() });
}
