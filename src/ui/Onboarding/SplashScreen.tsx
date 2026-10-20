import { MovexMark } from '../components/icons';

export function SplashScreen() {
  return (
    <div className="ob-screen ob-splash">
      <div className="ob-logo-wrap">
        <MovexMark size={112} />
      </div>

      <h1 className="ob-app-name">movexnet</h1>
      <p className="ob-app-tagline">Tu cuerpo, leído en tiempo real</p>

      <div className="ob-dots-loader" aria-hidden="true">
        <span /><span /><span />
      </div>
    </div>
  );
}
