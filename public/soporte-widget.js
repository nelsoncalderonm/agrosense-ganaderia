/*
 * Widget de soporte Ganado al Día para incrustar en cualquier página (landing, blog).
 * Uso: <script src="https://SU-DOMINIO-DE-LA-APP/soporte-widget.js" defer></script>
 * Muestra un botón "¿Preguntas?" que abre el chat de /soporte en un panel.
 */
(function () {
  if (window.__agrosenseSoporte) return;
  window.__agrosenseSoporte = true;

  var script = document.currentScript;
  var base = script ? new URL(script.src).origin : '';
  var color = (script && script.getAttribute('data-color')) || '#15A34A';
  var texto = (script && script.getAttribute('data-texto')) || '¿Preguntas?';

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Abrir chat de ayuda de Ganado al Día');
  btn.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><span></span>';
  btn.querySelector('span').textContent = texto;
  btn.style.cssText =
    'position:fixed;right:16px;bottom:16px;z-index:2147483000;height:52px;padding:0 18px 0 14px;border:none;border-radius:26px;' +
    'background:' + color + ';color:#fff;font:700 15px system-ui,sans-serif;display:flex;align-items:center;gap:8px;' +
    'box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer';

  var panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;right:16px;bottom:80px;z-index:2147483001;width:min(380px,calc(100vw - 32px));height:min(600px,calc(100dvh - 110px));' +
    'border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.3);display:none;background:#fff';

  var cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.setAttribute('aria-label', 'Cerrar chat');
  cerrar.textContent = '×';
  cerrar.style.cssText =
    'position:absolute;top:8px;right:8px;z-index:2;width:32px;height:32px;border:none;border-radius:16px;background:rgba(255,255,255,.2);color:#fff;font:400 22px/1 system-ui;cursor:pointer';

  var iframe = null;
  function abrir() {
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.src = base + '/soporte?origen=landing';
      iframe.title = 'Chat de ayuda Ganado al Día';
      iframe.style.cssText = 'width:100%;height:100%;border:0';
      panel.appendChild(iframe);
      panel.appendChild(cerrar);
    }
    panel.style.display = 'block';
    btn.style.display = 'none';
  }
  function ocultar() {
    panel.style.display = 'none';
    btn.style.display = 'flex';
  }
  btn.addEventListener('click', abrir);
  cerrar.addEventListener('click', ocultar);

  document.body.appendChild(panel);
  document.body.appendChild(btn);
})();
