"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es" className="dark">
      <head>
        <title>Algo salió mal | MangaStoon</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700;800;900&display=swap" rel="stylesheet" />
        <style>{`
          body {
            background-color: #0a0908;
            color: #ffffff;
            font-family: 'Inter', sans-serif;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 16px;
          }
          .card {
            position: relative;
            width: 100%;
            max-w: 500px;
            overflow: hidden;
            border-radius: 32px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background-color: #131110;
            padding: 32px;
            text-align: center;
            box-shadow: 0 24px 48px rgba(0,0,0,0.6);
          }
          .glow {
            pointer-events: none;
            position: absolute;
            left: 50%;
            top: 0;
            height: 160px;
            width: 160px;
            transform: translateX(-50%);
            border-radius: 9999px;
            background-color: rgba(249, 115, 22, 0.15);
            filter: blur(48px);
          }
          .icon-container {
            position: relative;
            margin: 0 auto 24px;
            display: flex;
            height: 80px;
            width: 80px;
            align-items: center;
            justify-content: center;
            border-radius: 9999px;
            border: 1px solid rgba(249, 115, 22, 0.3);
            background-color: rgba(249, 115, 22, 0.1);
            color: #ff6b00;
          }
          .tag {
            font-family: 'Outfit', sans-serif;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.25em;
            color: #ff6b00;
          }
          .title {
            font-family: 'Outfit', sans-serif;
            margin-top: 12px;
            font-size: 32px;
            font-weight: 900;
            letter-spacing: -0.02em;
            line-height: 1.2;
            color: #ffffff;
          }
          .description {
            margin: 16px auto 0;
            max-w: 380px;
            font-size: 14px;
            line-height: 1.6;
            color: #c2b8a6;
            opacity: 0.8;
          }
          .code {
            margin-top: 16px;
            font-family: monospace;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.25);
          }
          .button-group {
            margin-top: 32px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          @media (min-width: 640px) {
            .button-group {
              flex-direction: row;
              justify-content: center;
            }
          }
          .btn-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            cursor: pointer;
            border-radius: 9999px;
            background-color: #ff6b00;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 700;
            color: #000000;
            border: none;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2);
          }
          .btn-primary:hover {
            background-color: #ff8533;
            transform: scale(1.02);
          }
          .btn-primary:active {
            transform: scale(0.98);
          }
          .btn-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 9999px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background-color: rgba(255, 255, 255, 0.03);
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
            text-decoration: none;
            transition: all 0.2s;
          }
          .btn-secondary:hover {
            border-color: rgba(249, 115, 22, 0.4);
            color: #ff6b00;
            background-color: rgba(249, 115, 22, 0.05);
          }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="glow" />
          <div className="icon-container">
            <AlertTriangle size={36} className="animate-pulse" />
          </div>
          <span className="tag">Algo salió mal</span>
          <h1 className="title">MangaStoon fue enviado a otro mundo</h1>
          <p className="description">
            Ocurrió un error inesperado al invocar la página. No te desesperes, estamos lanzando un hechizo de resurrección para restaurar todo.
          </p>
          {error.digest && (
            <p className="code">Código de error: {error.digest}</p>
          )}
          <div className="button-group">
            <button
              type="button"
              onClick={() => reset()}
              className="btn-primary"
            >
              <RefreshCw size={16} />
              <span>Intentar de nuevo</span>
            </button>
            <a href="/" className="btn-secondary">
              Volver al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
