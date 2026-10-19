import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MovexMark, IconVoice, IconVoiceOff } from '../components/icons';
import { PremiumSheet } from '../components/PremiumSheet';
import { appActions, useAppState } from '../state/appStore';
import { totals } from '../../domain/sessionHistory';
import { computeStats } from '../../domain/progress';
import { AchievementsSection, GoalsSection, ProgressStats } from './ProgressSections';
import { MockPaymentProvider } from '../../domain/payment';
import { authRepository, useAccount } from '../state/accountStore';

const ONBOARDING_KEY = 'ob_complete_v1';

/** Estado de la cuenta (issue #60). Con las cuentas apagadas no se muestra nada. */
function AccountSection() {
  const { status, user } = useAccount();
  const [busy, setBusy] = useState(false);
  if (status === 'disabled') return null;

  async function signOut() {
    setBusy(true);
    try {
      await (await authRepository()).signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card--framed">
      <h2 className="card-title">Cuenta</h2>
      {status === 'loading' && <p className="muted" role="status">Cargando…</p>}
      {status === 'signed_out' && (
        <>
          <Link className="list-row exercise-row" to="/cuenta/entrar">
            <span className="list-row__main">
              <span className="list-row__title">Iniciar sesión</span>
              <span className="list-row__meta">Con tu correo y contraseña</span>
            </span>
          </Link>
          <Link className="list-row exercise-row" to="/cuenta/registro">
            <span className="list-row__main">
              <span className="list-row__title">Crear cuenta</span>
              <span className="list-row__meta">Solo mayores de 18 años</span>
            </span>
          </Link>
        </>
      )}
      {status === 'signed_in' && user && (
        <>
          <div className="list-row">
            <span className="list-row__main">
              <span className="list-row__title">Sesión iniciada</span>
              <span className="list-row__meta">{user.email}</span>
            </span>
          </div>
          <Link className="list-row exercise-row" to="/cuenta/nueva-clave">
            <span className="list-row__main"><span className="list-row__title">Cambiar contraseña</span></span>
          </Link>
          <button className="list-row exercise-row" onClick={signOut} disabled={busy}>
            <span className="list-row__main">
              <span className="list-row__title">{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
              <span className="list-row__meta">En este celular</span>
            </span>
          </button>
        </>
      )}
      <Link className="list-row exercise-row" to="/privacidad">
        <span className="list-row__main"><span className="list-row__title">Aviso de privacidad</span></span>
      </Link>
    </section>
  );
}

export function ProfileScreen() {
  const { history, entitlement, voiceEnabled, questionnaire, goals } = useAppState();
  const [premiumOpen, setPremiumOpen] = useState(false);
  const t = totals(history);
  // Todo se deriva del historial en cada render (DEC-041): nada de progreso se guarda acumulado.
  const stats = computeStats(history, new Date());

  async function cancelPremium() {
    appActions.setEntitlement(await new MockPaymentProvider().cancel());
  }

  function replayOnboarding() {
    try { localStorage.removeItem(ONBOARDING_KEY); } catch { /* almacenamiento bloqueado */ }
    window.location.reload();
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1 className="screen-title">Perfil</h1>
        <MovexMark size={36} />
      </header>

      <div className="grid-2">
        <div className="card"><span className="muted">Series</span><span className="display-number stat-number">{t.sets}</span></div>
        <div className="card"><span className="muted">Repeticiones</span><span className="display-number stat-number">{t.reps}</span></div>
        <div className="card"><span className="muted">Días activos</span><span className="display-number stat-number">{t.activeDays}</span></div>
        <div className="card">
          <span className="muted">Plan</span>
          <span className={`display-number stat-number${entitlement.premium ? ' is-volt' : ''}`}>{entitlement.premium ? 'Premium' : 'Libre'}</span>
        </div>
      </div>

      <ProgressStats stats={stats} />
      <GoalsSection goals={goals} stats={stats} />
      <AchievementsSection stats={stats} />

      <AccountSection />

      <section className="card card--framed">
        <h2 className="card-title">Ajustes</h2>
        <button className="list-row exercise-row" onClick={() => appActions.setVoice(!voiceEnabled)} aria-pressed={voiceEnabled}>
          <span className="list-row__main">
            <span className="list-row__title">Voz del asistente</span>
            <span className="list-row__meta">{voiceEnabled ? 'Te corrige en voz alta durante la serie' : 'Solo avisos en pantalla'}</span>
          </span>
          <span className={`pill ${voiceEnabled ? 'pill--volt' : 'pill--neutral'}`}>{voiceEnabled ? <IconVoice /> : <IconVoiceOff />}{voiceEnabled ? 'Activada' : 'Apagada'}</span>
        </button>
        <Link className="list-row exercise-row" to="/cuestionario">
          <span className="list-row__main">
            <span className="list-row__title">{questionnaire ? 'Cambiar mis respuestas' : 'Armar mi programa'}</span>
            <span className="list-row__meta">Objetivo, nivel, lugar y días</span>
          </span>
        </Link>
        {entitlement.premium ? (
          <button className="list-row exercise-row" onClick={cancelPremium}>
            <span className="list-row__main">
              <span className="list-row__title">Desactivar Premium de prueba</span>
              <span className="list-row__meta">Pago simulado: no hay nada que reembolsar</span>
            </span>
          </button>
        ) : (
          <button className="list-row exercise-row" onClick={() => setPremiumOpen(true)}>
            <span className="list-row__main">
              <span className="list-row__title">Probar Premium</span>
              <span className="list-row__meta">Pago simulado, sin costo</span>
            </span>
          </button>
        )}
        <button className="list-row exercise-row" onClick={replayOnboarding}>
          <span className="list-row__main">
            <span className="list-row__title">Ver la bienvenida otra vez</span>
          </span>
        </button>
      </section>

      <p className="muted cues">
        Tu historial se guarda solo en este celular. El video de la cámara nunca sale del dispositivo.
      </p>
      {premiumOpen && <PremiumSheet onClose={() => setPremiumOpen(false)} />}
    </div>
  );
}
