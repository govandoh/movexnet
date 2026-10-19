import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { IconCalendar, IconDumbbell, IconFigure, IconToday, IconUser } from './components/icons';
import { useAccount } from './state/accountStore';

/**
 * El enlace de recuperación vuelve a la raíz del sitio (`/?code=…`, DEC-069) y cae en Hoy;
 * cuando Auth avisa `password_recovery`, se lleva al usuario a elegir la contraseña nueva.
 * Si el enlace falló (vencido, usado o abierto en otro navegador), a iniciar sesión, que lo explica.
 */
function useRecoveryRedirect() {
  const { recovery, linkError } = useAccount();
  const navigate = useNavigate();
  useEffect(() => {
    if (recovery) navigate('/cuenta/nueva-clave');
    else if (linkError) navigate('/cuenta/entrar');
  }, [recovery, linkError, navigate]);
}

/**
 * Contenedor de las pantallas de gestión: contenido desplazable y navegación inferior de
 * cinco pestañas con "Entrenar" al centro (DEC-058). La pantalla de entrenamiento queda
 * fuera: ocupa todo el alto y no comparte espacio con la barra.
 */
export function AppShell() {
  useRecoveryRedirect();
  return (
    <div className="app-shell">
      <main className="app-content">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Navegación principal">
        <NavLink to="/" end className="bottom-nav__item"><IconToday />Hoy</NavLink>
        <NavLink to="/rutinas" className="bottom-nav__item"><IconCalendar />Rutinas</NavLink>
        <NavLink to="/entrenar" className="bottom-nav__train" aria-label="Entrenar con asistente"><IconFigure /></NavLink>
        <NavLink to="/ejercicios" className="bottom-nav__item"><IconDumbbell />Ejercicios</NavLink>
        <NavLink to="/perfil" className="bottom-nav__item"><IconUser />Perfil</NavLink>
      </nav>
    </div>
  );
}
