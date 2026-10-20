import { NavLink, Outlet } from 'react-router-dom';
import { IconCalendar, IconDumbbell, IconFigure, IconToday, IconUser } from './components/icons';

/**
 * Contenedor de las pantallas de gestión: contenido desplazable y navegación inferior de
 * cinco pestañas con "Entrenar" al centro (DEC-058). La pantalla de entrenamiento queda
 * fuera: ocupa todo el alto y no comparte espacio con la barra.
 */
export function AppShell() {
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
