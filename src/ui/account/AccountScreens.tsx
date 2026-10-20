import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getAccountsConfig } from '../../api-client/index.ts';
import {
  AuthError, MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, PRIVACY_VERSION, isValidEmail, passwordIssues,
  passwordMessage, validateSignUp, type SignUpField,
} from '../../domain/auth.ts';
import { IconBack, IconCheck } from '../components/icons';
import { accountActions, authRepository, useAccount } from '../state/accountStore';
import { PrivacyNotice } from './PrivacyNotice';
import { Turnstile } from './Turnstile';
import './account.css';

/**
 * Pantallas de cuenta (issue #60, DEC-069). Reglas de seguridad de la UI:
 * - Solo se muestra `AuthError.message` (mensajes fijos); nunca el error crudo ni nada en consola.
 * - Registro y recuperación dicen siempre lo mismo, exista o no el correo (anti enumeración).
 * - La contraseña vive solo en el estado local del formulario y se borra al enviar.
 * - El botón se bloquea mientras la petición está en curso (sin dobles envíos).
 */

function errorText(e: unknown): string {
  return e instanceof AuthError ? e.message : new AuthError('unknown').message;
}

/** Captcha si hay site key (nube); el token se renueva tras cada intento porque es de un solo uso. */
function useCaptcha() {
  const siteKey = getAccountsConfig()?.turnstileSiteKey ?? null;
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  return {
    ready: siteKey === null || token !== null,
    token: token ?? undefined,
    reset: () => setResetKey(k => k + 1),
    widget: siteKey ? <Turnstile siteKey={siteKey} resetKey={resetKey} onToken={setToken} /> : null,
  };
}

function AccountLayout({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { status } = useAccount();
  // Sin sesión, la app entera está detrás de la cuenta (DEC-069): volver es ir a la bienvenida.
  const back = status === 'signed_in' ? '/perfil' : '/cuenta';
  return (
    <div className="flow">
      <div className="flow__top">
        <button type="button" className="icon-btn" aria-label="Volver" onClick={() => navigate(back)}><IconBack /></button>
      </div>
      <div className="flow__intro">
        <p className="eyebrow">Tu cuenta</p>
        <h1 className="flow__title">{title}</h1>
        {lead && <p className="flow__lead">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="account-field">
      <label className="field-label" htmlFor={id}>{label}</label>
      {children(id, error || hint ? msgId : undefined)}
      {error ? <span id={msgId} className="account-field__error">{error}</span>
        : hint ? <span id={msgId} className="account-field__hint">{hint}</span> : null}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, describedBy, invalid }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: 'current-password' | 'new-password';
  describedBy?: string; invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="account-password">
      <input
        id={id} className="account-input" type={visible ? 'text' : 'password'} value={value}
        onChange={e => onChange(e.target.value)} autoComplete={autoComplete} autoCapitalize="none"
        autoCorrect="off" spellCheck={false} required aria-describedby={describedBy} aria-invalid={invalid || undefined}
      />
      <button type="button" className="account-password__toggle" aria-pressed={visible} onClick={() => setVisible(v => !v)}>
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  );
}

function FormAlert({ text }: { text: string | null }) {
  return <p className="account-alert" role="alert">{text ?? ''}</p>;
}

function SentNotice({ title, text, action }: { title: string; text: string; action: ReactNode }) {
  return (
    <AccountLayout title={title}>
      <div className="card card--framed account-sent" role="status">
        <span className="account-sent__icon"><IconCheck /></span>
        <p>{text}</p>
      </div>
      <div className="flow__spacer" />
      {action}
    </AccountLayout>
  );
}

// ── Registro ─────────────────────────────────────────────────────────────────

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function SignUpScreen() {
  const { status } = useAccount();
  const captcha = useCaptcha();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SignUpField, string>>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  if (status === 'disabled') return <Navigate to="/perfil" replace />;
  if (sent) {
    return (
      <SentNotice
        title="Revisa tu correo"
        text="Si el correo es válido, te enviamos un enlace para confirmar la cuenta. Al abrirlo quedas con la sesión iniciada en ese navegador."
        action={<Link className="btn btn--primary btn--block" to="/cuenta/entrar">Ir a iniciar sesión</Link>}
      />
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const input = {
      email, password, displayName: name, birthYear: Number(birthYear), birthMonth: Number(birthMonth),
      privacyVersion: accepted ? PRIVACY_VERSION : '', captchaToken: captcha.token,
    };
    const found = validateSignUp(input, new Date());
    setErrors(found);
    setAlert(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const { needsEmailConfirmation } = await (await authRepository()).signUp(input);
      setPassword('');
      if (needsEmailConfirmation) setSent(true);
      else navigate('/', { replace: true });
    } catch (err) {
      setAlert(errorText(err));
    } finally {
      setBusy(false);
      captcha.reset();
    }
  }

  if (showNotice) return <PrivacyNotice onClose={() => setShowNotice(false)} />;

  return (
    <AccountLayout title="Crear cuenta" lead="Tu historial sigue en este celular; la cuenta es la base para sincronizarlo más adelante.">
      <form className="account-form" onSubmit={submit} noValidate>
        <Field label="Nombre" error={errors.displayName}>
          {(id, d) => <input id={id} className="account-input" value={name} onChange={e => setName(e.target.value)}
            autoComplete="nickname" maxLength={60} required aria-describedby={d} aria-invalid={!!errors.displayName || undefined} />}
        </Field>
        <Field label="Correo" error={errors.email}>
          {(id, d) => <input id={id} className="account-input" type="email" inputMode="email" value={email}
            onChange={e => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false}
            maxLength={254} required aria-describedby={d} aria-invalid={!!errors.email || undefined} />}
        </Field>
        <Field label="Contraseña" error={errors.password}
          hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres, con mayúsculas, minúsculas y números.`}>
          {(id, d) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="new-password"
            describedBy={d} invalid={!!errors.password} />}
        </Field>
        <fieldset className="account-field account-birth" aria-describedby="birth-msg">
          <legend className="field-label">Mes y año de nacimiento</legend>
          <div className="account-birth__row">
            <select className="account-input" aria-label="Mes de nacimiento" value={birthMonth}
              onChange={e => setBirthMonth(e.target.value)} autoComplete="bday-month" required
              aria-invalid={!!errors.birthDate || undefined}>
              <option value="" disabled>Mes</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input className="account-input" aria-label="Año de nacimiento" placeholder="Año" inputMode="numeric"
              pattern="[0-9]*" value={birthYear} onChange={e => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              autoComplete="bday-year" required aria-invalid={!!errors.birthDate || undefined} />
          </div>
          <span id="birth-msg" className={errors.birthDate ? 'account-field__error' : 'account-field__hint'}>
            {errors.birthDate ?? 'Solo para confirmar que tienes 18 años o más.'}
          </span>
        </fieldset>
        <div className="account-field">
          <label className="account-check">
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
              aria-invalid={!!errors.privacy || undefined} />
            <span>Leí y acepto el <button type="button" className="account-link" onClick={() => setShowNotice(true)}>aviso de privacidad</button>.</span>
          </label>
          {errors.privacy && <span className="account-field__error">{errors.privacy}</span>}
        </div>
        {captcha.widget}
        <FormAlert text={alert} />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !captcha.ready}>
          {busy ? 'Creando…' : 'Crear cuenta'}
        </button>
        <p className="muted account-foot">¿Ya tienes cuenta? <Link className="account-link" to="/cuenta/entrar">Inicia sesión</Link></p>
      </form>
    </AccountLayout>
  );
}

// ── Inicio de sesión ─────────────────────────────────────────────────────────

export function SignInScreen() {
  const { status, linkError } = useAccount();
  const captcha = useCaptcha();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (status === 'disabled') return <Navigate to="/perfil" replace />;
  if (status === 'signed_in') return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isValidEmail(email) || password.length === 0) {
      setAlert('Escribe tu correo y tu contraseña.');
      return;
    }
    setBusy(true);
    setAlert(null);
    try {
      await (await authRepository()).signIn({ email, password, captchaToken: captcha.token });
      setPassword('');
      navigate('/', { replace: true });
    } catch (err) {
      setAlert(errorText(err));
    } finally {
      setBusy(false);
      captcha.reset();
    }
  }

  return (
    <AccountLayout title="Iniciar sesión">
      {linkError && (
        <div className="card account-note" role="status">
          <p>El enlace venció o ya se usó. Si era para confirmar tu correo, prueba a iniciar sesión; si no, pide un enlace nuevo.</p>
          <button type="button" className="account-link" onClick={accountActions.dismissLinkError}>Entendido</button>
        </div>
      )}
      <form className="account-form" onSubmit={submit} noValidate>
        <Field label="Correo">
          {id => <input id={id} className="account-input" type="email" inputMode="email" value={email}
            onChange={e => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none"
            spellCheck={false} maxLength={254} required />}
        </Field>
        <Field label="Contraseña">
          {id => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="current-password" />}
        </Field>
        {captcha.widget}
        <FormAlert text={alert} />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !captcha.ready}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="muted account-foot">
          <Link className="account-link" to="/cuenta/recuperar">Olvidé mi contraseña</Link>
          {' · '}
          <Link className="account-link" to="/cuenta/registro">Crear cuenta</Link>
        </p>
      </form>
    </AccountLayout>
  );
}

// ── Recuperar contraseña ─────────────────────────────────────────────────────

export function ResetRequestScreen() {
  const { status } = useAccount();
  const captcha = useCaptcha();
  const [email, setEmail] = useState('');
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (status === 'disabled') return <Navigate to="/perfil" replace />;
  if (sent) {
    return (
      <SentNotice
        title="Revisa tu correo"
        text="Si hay una cuenta con ese correo, te enviamos un enlace para elegir una contraseña nueva. Vence en una hora y sirve una sola vez."
        action={<Link className="btn btn--secondary btn--block" to="/cuenta/entrar">Volver a iniciar sesión</Link>}
      />
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isValidEmail(email)) {
      setAlert('Escribe un correo válido.');
      return;
    }
    setBusy(true);
    setAlert(null);
    try {
      await (await authRepository()).requestPasswordReset({ email, captchaToken: captcha.token });
      setSent(true);
    } catch (err) {
      setAlert(errorText(err));
    } finally {
      setBusy(false);
      captcha.reset();
    }
  }

  return (
    <AccountLayout title="Recuperar contraseña" lead="Te enviamos un enlace para elegir una contraseña nueva.">
      <form className="account-form" onSubmit={submit} noValidate>
        <Field label="Correo">
          {id => <input id={id} className="account-input" type="email" inputMode="email" value={email}
            onChange={e => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none"
            spellCheck={false} maxLength={254} required />}
        </Field>
        {captcha.widget}
        <FormAlert text={alert} />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !captcha.ready}>
          {busy ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>
    </AccountLayout>
  );
}

// ── Contraseña nueva (tras el enlace de recuperación o desde Perfil) ─────────

export function NewPasswordScreen() {
  const { status, recovery } = useAccount();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Con `secure_password_change`, un cambio desde Perfil exige un inicio de sesión reciente.
  const [needsReauth, setNeedsReauth] = useState(false);
  const navigate = useNavigate();

  if (status === 'disabled' || status === 'signed_out') return <Navigate to="/cuenta/entrar" replace />;
  if (done) {
    return (
      <SentNotice
        title="Contraseña cambiada"
        text="Tu contraseña nueva ya está activa."
        action={<Link className="btn btn--primary btn--block" to="/perfil">Ir a mi perfil</Link>}
      />
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const issues = passwordIssues(password);
    if (issues.length > 0) return setError(passwordMessage(issues));
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setError(null);
    setAlert(null);
    setBusy(true);
    try {
      await (await authRepository()).updatePassword(password);
      setPassword('');
      setConfirm('');
      accountActions.recoveryDone();
      setDone(true);
    } catch (err) {
      setAlert(errorText(err));
      setNeedsReauth(err instanceof AuthError && err.code === 'reauthentication_needed');
    } finally {
      setBusy(false);
    }
  }

  async function signOutAndReenter() {
    await (await authRepository()).signOut();
    navigate('/cuenta/entrar', { replace: true });
  }

  return (
    <AccountLayout title="Contraseña nueva" lead={recovery ? 'Elige la contraseña con la que vas a entrar.' : undefined}>
      <form className="account-form" onSubmit={submit} noValidate>
        <Field label="Contraseña nueva" error={error ?? undefined}
          hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres, con mayúsculas, minúsculas y números; máximo ${MAX_PASSWORD_BYTES}.`}>
          {(id, d) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="new-password"
            describedBy={d} invalid={!!error} />}
        </Field>
        <Field label="Repite la contraseña">
          {id => <PasswordInput id={id} value={confirm} onChange={setConfirm} autoComplete="new-password" />}
        </Field>
        <FormAlert text={alert} />
        {needsReauth && (
          <button type="button" className="btn btn--secondary btn--block" onClick={signOutAndReenter}>
            Cerrar sesión y volver a entrar
          </button>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </AccountLayout>
  );
}

// ── Bienvenida de la cuenta: la puerta de la app con las cuentas activas ─────

export function AccountWelcomeScreen() {
  const { status } = useAccount();
  if (status === 'disabled') return <Navigate to="/" replace />;
  if (status === 'signed_in') return <Navigate to="/" replace />;
  return (
    <div className="flow">
      <div className="flow__intro account-welcome">
        <p className="eyebrow">MovexNet</p>
        <h1 className="flow__title">Entra a tu cuenta</h1>
        <p className="flow__lead">
          Crea una cuenta o inicia sesión para entrenar con el asistente. El video de tu cámara nunca sale de tu celular.
        </p>
      </div>
      <div className="flow__spacer" />
      <Link className="btn btn--primary btn--block" to="/cuenta/registro">Crear cuenta</Link>
      <Link className="btn btn--secondary btn--block" to="/cuenta/entrar">Ya tengo cuenta</Link>
      <p className="muted account-foot">
        Solo para mayores de 18 años. <Link className="account-link" to="/privacidad">Aviso de privacidad</Link>
      </p>
    </div>
  );
}

// ── Aviso de privacidad como ruta propia (enlace desde Perfil) ───────────────

export function PrivacyScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  // Abierto directo (enlace o recarga) no hay historial dentro de la app: se vuelve a Perfil.
  return <PrivacyNotice onClose={() => (location.key === 'default' ? navigate('/perfil') : navigate(-1))} />;
}
