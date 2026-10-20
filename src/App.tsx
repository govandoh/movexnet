import { Suspense, lazy, useState } from 'react';
import { Navigate, Outlet, RouterProvider, createHashRouter } from 'react-router-dom';
import { OnboardingFlow } from './ui/Onboarding/OnboardingFlow';
import { AppShell } from './ui/AppShell';
import { TodayScreen } from './ui/screens/TodayScreen';
import { ProgramScreen } from './ui/screens/ProgramScreen';
import { ExercisesScreen } from './ui/screens/ExercisesScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { QuestionnaireScreen } from './ui/screens/QuestionnaireScreen';
import { WorkoutScreen } from './ui/workout/WorkoutScreen';
import { startAccount, useAccount } from './ui/state/accountStore';

// El editor y el modo manual se cargan al entrar: así el shell inicial no los incluye (issue #34).
const RoutineEditorScreen = lazy(() => import('./ui/routines/RoutineEditorScreen').then(m => ({ default: m.RoutineEditorScreen })));
const ManualWorkoutScreen = lazy(() => import('./ui/manual/ManualWorkoutScreen').then(m => ({ default: m.ManualWorkoutScreen })));
// Pantallas de cuenta (issue #60): un solo trozo, fuera del shell inicial.
const account = () => import('./ui/account/AccountScreens');
const SignInScreen = lazy(() => account().then(m => ({ default: m.SignInScreen })));
const SignUpScreen = lazy(() => account().then(m => ({ default: m.SignUpScreen })));
const ResetRequestScreen = lazy(() => account().then(m => ({ default: m.ResetRequestScreen })));
const NewPasswordScreen = lazy(() => account().then(m => ({ default: m.NewPasswordScreen })));
const PrivacyScreen = lazy(() => account().then(m => ({ default: m.PrivacyScreen })));
const AccountWelcomeScreen = lazy(() => account().then(m => ({ default: m.AccountWelcomeScreen })));

// Antes de montar nada: el cliente de Supabase canjea el código del enlace del correo que
// viene en la URL. No hace nada con las cuentas apagadas (DEC-069).
startAccount();

const ONBOARDING_KEY = 'ob_complete_v1';

function Loading() {
  return <div className="screen" role="status" aria-live="polite"><p className="muted">Cargando…</p></div>;
}

/**
 * Con las cuentas activas, la app pide iniciar sesión o registrarse antes de dejar entrenar
 * (DEC-069). La sesión se lee del dispositivo, así que un usuario con sesión entra aunque no
 * haya red. Con las cuentas apagadas (`VITE_ENABLE_ACCOUNTS`) no hay puerta: la app es la de hoy.
 * También lleva a la contraseña nueva tras el enlace de recuperación, y a Iniciar sesión, que
 * lo explica, si el enlace del correo falló.
 */
function RequireAccount() {
  const { status, recovery, linkError } = useAccount();
  if (status === 'disabled') return <Outlet />;
  if (status === 'loading') return <Loading />;
  if (recovery) return <Navigate to="/cuenta/nueva-clave" replace />;
  if (status === 'signed_out') return <Navigate to={linkError ? '/cuenta/entrar' : '/cuenta'} replace />;
  return <Outlet />;
}

/**
 * Enrutador por fragmento (DEC-042): la PWA se sirve como archivos estáticos y el service
 * worker solo conoce "/"; con el hash no hace falta reescribir rutas en Vercel ni en el SW.
 * Es `createHashRouter` y no `HashRouter` porque el editor de rutinas necesita `useBlocker`
 * para avisar antes de salir con cambios sin guardar (DEC-052).
 *
 * El editor, el modo manual y el entrenamiento van fuera de `AppShell`: ocupan todo el alto y
 * no deben compartir espacio con la barra de navegación.
 */
const router = createHashRouter([
  {
    element: <RequireAccount />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <TodayScreen /> },
          { path: 'rutinas', element: <ProgramScreen /> },
          { path: 'ejercicios', element: <ExercisesScreen /> },
          { path: 'perfil', element: <ProfileScreen /> },
        ],
      },
      { path: 'cuestionario', element: <QuestionnaireScreen /> },
      { path: 'entrenar', element: <WorkoutScreen /> },
      { path: 'rutinas/editar/:id', element: <Suspense fallback={<Loading />}><RoutineEditorScreen /></Suspense> },
      { path: 'manual', element: <Suspense fallback={<Loading />}><ManualWorkoutScreen /></Suspense> },
    ],
  },
  // Sin sesión solo se llega a estas: bienvenida de la cuenta, acceso, recuperación y aviso.
  { path: 'cuenta', element: <Suspense fallback={<Loading />}><AccountWelcomeScreen /></Suspense> },
  { path: 'cuenta/entrar', element: <Suspense fallback={<Loading />}><SignInScreen /></Suspense> },
  { path: 'cuenta/registro', element: <Suspense fallback={<Loading />}><SignUpScreen /></Suspense> },
  { path: 'cuenta/recuperar', element: <Suspense fallback={<Loading />}><ResetRequestScreen /></Suspense> },
  { path: 'cuenta/nueva-clave', element: <Suspense fallback={<Loading />}><NewPasswordScreen /></Suspense> },
  { path: 'privacidad', element: <Suspense fallback={<Loading />}><PrivacyScreen /></Suspense> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

function App() {
  const [ready, setReady] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) === '1'; } catch { return false; }
  });

  const handleComplete = () => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* storage bloqueado o en modo privado */ }
    setReady(true);
  };

  if (!ready) return <OnboardingFlow onComplete={handleComplete} />;
  return <RouterProvider router={router} />;
}

export default App;
