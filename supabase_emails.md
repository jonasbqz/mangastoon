# Plantillas de Correo para Supabase Auth (Español Neutro + Modo Oscuro/Claro)

Estas plantillas están diseñadas para ser copiadas y pegadas directamente en el panel de control de tu proyecto de Supabase (**Auth -> Email Templates**).

Soportan automáticamente la detección de **Modo Oscuro** y **Modo Claro** del cliente de correo (Gmail, Outlook, Apple Mail, etc.) y están completamente redactadas en **Español Neutro** (sin modismos ni voseo).

---

## 1. Confirmar Registro (Confirm Signup)

### Asunto (Subject)
`Confirmación de Cuenta de MangaStoon`

### Contenido HTML (Body)
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Confirmación de Cuenta</title>
  <style>
    /* Estilos por defecto (Modo Claro) */
    body {
      background-color: #f6f5f4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    .wrapper {
      background-color: #f6f5f4;
      padding: 40px 20px;
    }
    .card {
      background-color: #ffffff;
      border: 1px solid #e5e5e5;
      border-radius: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      max-width: 480px;
      margin: 0 auto;
      padding: 40px 30px;
      text-align: center;
    }
    .logo {
      color: #ff6b00;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 2px;
      margin-bottom: 24px;
      text-transform: uppercase;
    }
    .text-title {
      color: #121110;
      font-size: 20px;
      font-weight: 800;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .text-body {
      color: #666666;
      font-size: 13px;
      line-height: 1.6;
      margin-top: 0;
      margin-bottom: 28px;
    }
    .btn {
      background-color: #ff6b00;
      border-radius: 14px;
      color: #ffffff !important;
      display: inline-block;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 14px 32px;
      text-decoration: none;
      text-transform: uppercase;
    }
    .divider {
      border-top: 1px solid #e5e5e5;
      margin: 28px 0;
    }
    .text-footer {
      color: #999999;
      font-size: 11px;
      line-height: 1.5;
      margin: 0;
    }

    /* Estilos para Modo Oscuro */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #0d0c0b !important;
      }
      .wrapper {
        background-color: #0d0c0b !important;
      }
      .card {
        background-color: #161514 !important;
        border-color: #2b2927 !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
      }
      .text-title {
        color: #f7f2e8 !important;
      }
      .text-body {
        color: #a39e93 !important;
      }
      .btn {
        background-color: #ff6b00 !important;
        color: #0d0c0b !important;
      }
      .divider {
        border-top-color: #2b2927 !important;
      }
      .text-footer {
        color: #706b62 !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo">MangaStoon</div>
      <div class="text-title">¡Te damos la bienvenida, {{ .User.UserMetadata.username }}!</div>
      <div class="text-body">
        Gracias por unirte a nuestra comunidad. Para completar tu registro, empezar a guardar tus lecturas favoritas, organizar tus colecciones y comentar los capítulos, confirma tu correo haciendo clic en el botón de abajo:
      </div>
      <div>
        <a href="{{ .ConfirmationURL }}" class="btn">Confirmar mi cuenta</a>
      </div>
      <div class="divider"></div>
      <div class="text-footer">
        Si no has solicitado crear esta cuenta, puedes ignorar este correo de forma segura.<br><br>
        MangaStoon &copy; 2026. Todos los derechos reservados.
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 2. Restablecer Contraseña (Reset Password)

### Asunto (Subject)
`Restablecer contraseña de MangaStoon`

### Contenido HTML (Body)
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Restablecer Contraseña</title>
  <style>
    /* Estilos por defecto (Modo Claro) */
    body {
      background-color: #f6f5f4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    .wrapper {
      background-color: #f6f5f4;
      padding: 40px 20px;
    }
    .card {
      background-color: #ffffff;
      border: 1px solid #e5e5e5;
      border-radius: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      max-width: 480px;
      margin: 0 auto;
      padding: 40px 30px;
      text-align: center;
    }
    .logo {
      color: #ff6b00;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 2px;
      margin-bottom: 24px;
      text-transform: uppercase;
    }
    .text-title {
      color: #121110;
      font-size: 20px;
      font-weight: 800;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .text-body {
      color: #666666;
      font-size: 13px;
      line-height: 1.6;
      margin-top: 0;
      margin-bottom: 28px;
    }
    .btn {
      background-color: #ff6b00;
      border-radius: 14px;
      color: #ffffff !important;
      display: inline-block;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 14px 32px;
      text-decoration: none;
      text-transform: uppercase;
    }
    .divider {
      border-top: 1px solid #e5e5e5;
      margin: 28px 0;
    }
    .text-footer {
      color: #999999;
      font-size: 11px;
      line-height: 1.5;
      margin: 0;
    }

    /* Estilos para Modo Oscuro */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #0d0c0b !important;
      }
      .wrapper {
        background-color: #0d0c0b !important;
      }
      .card {
        background-color: #161514 !important;
        border-color: #2b2927 !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
      }
      .text-title {
        color: #f7f2e8 !important;
      }
      .text-body {
        color: #a39e93 !important;
      }
      .btn {
        background-color: #ff6b00 !important;
        color: #0d0c0b !important;
      }
      .divider {
        border-top-color: #2b2927 !important;
      }
      .text-footer {
        color: #706b62 !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo">MangaStoon</div>
      <div class="text-title">Restablecer Contraseña</div>
      <div class="text-body">
        Has solicitado restablecer la contraseña de tu cuenta de MangaStoon. Para continuar con el proceso y definir una nueva contraseña, haz clic en el botón de abajo:
      </div>
      <div>
        <a href="{{ .ConfirmationURL }}" class="btn">Restablecer Contraseña</a>
      </div>
      <div class="divider"></div>
      <div class="text-footer">
        Si no has solicitado este cambio, puedes ignorar este correo de forma segura. Tu contraseña seguirá siendo la misma.<br><br>
        MangaStoon &copy; 2026. Todos los derechos reservados.
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 3. Confirmar Cambio de Correo (Change Email Address)

### Asunto (Subject)
`Confirmar cambio de correo en MangaStoon`

### Contenido HTML (Body)
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Confirmar Cambio de Correo</title>
  <style>
    /* Estilos por defecto (Modo Claro) */
    body {
      background-color: #f6f5f4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    .wrapper {
      background-color: #f6f5f4;
      padding: 40px 20px;
    }
    .card {
      background-color: #ffffff;
      border: 1px solid #e5e5e5;
      border-radius: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      max-width: 480px;
      margin: 0 auto;
      padding: 40px 30px;
      text-align: center;
    }
    .logo {
      color: #ff6b00;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 2px;
      margin-bottom: 24px;
      text-transform: uppercase;
    }
    .text-title {
      color: #121110;
      font-size: 20px;
      font-weight: 800;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .text-body {
      color: #666666;
      font-size: 13px;
      line-height: 1.6;
      margin-top: 0;
      margin-bottom: 28px;
    }
    .btn {
      background-color: #ff6b00;
      border-radius: 14px;
      color: #ffffff !important;
      display: inline-block;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 14px 32px;
      text-decoration: none;
      text-transform: uppercase;
    }
    .divider {
      border-top: 1px solid #e5e5e5;
      margin: 28px 0;
    }
    .text-footer {
      color: #999999;
      font-size: 11px;
      line-height: 1.5;
      margin: 0;
    }

    /* Estilos para Modo Oscuro */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #0d0c0b !important;
      }
      .wrapper {
        background-color: #0d0c0b !important;
      }
      .card {
        background-color: #161514 !important;
        border-color: #2b2927 !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
      }
      .text-title {
        color: #f7f2e8 !important;
      }
      .text-body {
        color: #a39e93 !important;
      }
      .btn {
        background-color: #ff6b00 !important;
        color: #0d0c0b !important;
      }
      .divider {
        border-top-color: #2b2927 !important;
      }
      .text-footer {
        color: #706b62 !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo">MangaStoon</div>
      <div class="text-title">Confirmar Cambio de Correo</div>
      <div class="text-body">
        Has solicitado cambiar la dirección de correo electrónico asociada a tu cuenta de MangaStoon. Para confirmar la nueva dirección de correo, haz clic en el botón de abajo:
      </div>
      <div>
        <a href="{{ .ConfirmationURL }}" class="btn">Confirmar nuevo correo</a>
      </div>
      <div class="divider"></div>
      <div class="text-footer">
        Si no has solicitado este cambio, puedes ignorar este correo de forma segura.<br><br>
        MangaStoon &copy; 2026. Todos los derechos reservados.
      </div>
    </div>
  </div>
</body>
</html>
```
