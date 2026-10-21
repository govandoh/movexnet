import { describe, expect, it } from 'vitest';
import { isEmailLinkUrl } from './accountStore';

describe('isEmailLinkUrl', () => {
  const base = 'https://entrenador-personal-ia.vercel.app/';

  it('reconoce los enlaces del correo: token_hash, código PKCE y error de Auth', () => {
    expect(isEmailLinkUrl(`${base}?token_hash=abc&type=recovery#/cuenta/nueva-clave`)).toBe(true);
    expect(isEmailLinkUrl(`${base}?token_hash=abc&type=email`)).toBe(true);
    expect(isEmailLinkUrl(`${base}?code=123`)).toBe(true);
    expect(isEmailLinkUrl(`${base}?error=access_denied&error_code=otp_expired`)).toBe(true);
  });

  it('no confunde una apertura normal ni otros parámetros', () => {
    expect(isEmailLinkUrl(base)).toBe(false);
    expect(isEmailLinkUrl(`${base}#/perfil`)).toBe(false);
    expect(isEmailLinkUrl(`${base}?engine=3d&debug=record`)).toBe(false);
  });
});
