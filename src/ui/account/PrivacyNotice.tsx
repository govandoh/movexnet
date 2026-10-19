import { IconBack } from '../components/icons';
import { PRIVACY_VERSION } from '../../domain/auth.ts';

/**
 * Aviso de privacidad `privacy-2026-10-v1` con el contenido mínimo de DEC-067 §4.
 * BORRADOR: el responsable del proyecto debe aprobar el texto antes de activar las cuentas en
 * producción (`VITE_ENABLE_ACCOUNTS`). Un cambio de fondo sube `PRIVACY_VERSION` (y la función
 * `private.current_privacy_version()` con una migración) y pide aceptarlo de nuevo.
 */
export function PrivacyNotice({ onClose }: { onClose: () => void }) {
  return (
    <div className="flow">
      <div className="flow__top">
        <button type="button" className="icon-btn" aria-label="Volver" onClick={onClose}><IconBack /></button>
      </div>
      <div className="flow__intro">
        <p className="eyebrow">Versión {PRIVACY_VERSION}</p>
        <h1 className="flow__title">Aviso de privacidad</h1>
      </div>
      <article className="card card--framed privacy-notice">
        <h2>Proyecto académico</h2>
        <p>MovexNet es un proyecto de seminario universitario. No vende nada: los pagos de la app son simulados y nunca se te cobra.</p>

        <h2>Qué guardamos</h2>
        <p>Si creas una cuenta: tu correo, tu nombre, tu mes y año de nacimiento y, si los escribes, tu altura, peso y nivel. También tus sesiones, series y métricas de entrenamiento. Los puntos del cuerpo (landmarks) solo se guardan si das tu consentimiento en cada grabación.</p>

        <h2>Qué nunca guardamos</h2>
        <p>El video de la cámara nunca sale de tu celular. No guardamos datos de tarjeta.</p>

        <h2>Datos de salud</h2>
        <p>Tratamos tu actividad física y tus medidas corporales como datos sensibles de salud, aunque la ley no siempre los clasifique así.</p>

        <h2>Dónde se guardan</h2>
        <p>En servidores de Supabase en Estados Unidos (región us-east-1).</p>

        <h2>Asistente de IA</h2>
        <p>Si usas el asistente, se envían a Anthropic solo métricas agregadas y tus objetivos; nunca video ni puntos del cuerpo. Mientras el asistente funcione en modo de demostración no se envía nada.</p>

        <h2>Tus derechos</h2>
        <p>Puedes ver, exportar y borrar tus datos y tu cuenta, y retirar tus consentimientos. Mientras la app no tenga estas opciones en Perfil, pídelo al contacto de abajo desde el correo de tu cuenta; lo atendemos en un máximo de 30 días.</p>

        <h2>Rankings y perfil público</h2>
        <p>Nada tuyo es visible para otras personas salvo que lo actives tú.</p>

        <h2>Edad</h2>
        <p>Las cuentas son solo para mayores de 18 años.</p>

        <h2>Contacto</h2>
        <p>Responsable del proyecto: Gerardo Ovando, equipo MovexNet. Escribe a <a className="account-link" href="mailto:govandoh@miumg.edu.gt">govandoh@miumg.edu.gt</a> para cualquier pregunta o para ejercer tus derechos.</p>
      </article>
    </div>
  );
}
