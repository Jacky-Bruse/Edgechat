// Optional lettering must not be part of a route's CSS preload dependency chain.
// Keep the existing fonts, but let login/registration render with their fallbacks
// when Google Fonts is slow or unreachable.
export function loadAuthFonts() {
  if (document.getElementById('edgechat-auth-fonts')) return;
  const link = document.createElement('link');
  link.id = 'edgechat-auth-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Dancing+Script:wght@500;700&display=swap';
  document.head.appendChild(link);
}
