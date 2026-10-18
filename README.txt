MMRSIQ TA2 — версия 21 с защитой Cloudflare Turnstile

Шаг 1 (Cloudflare, обязательно до публикации обновлённой формы):
  Worker → Edit code → замените старый код содержимым файла
  mmrsiq_ta2_worker_turnstile.js (он поставляется ОТДЕЛЬНО от ZIP).
  Нажмите Deploy.
  Worker → Settings → Variables and Secrets:
  BOT_TOKEN (Secret), CHAT_ID (Secret), TURNSTILE_SECRET_KEY (Secret).
  Важно: старый код без проверки Turnstile нельзя оставлять на публикации.

Шаг 2 (GitHub Pages):
  Загрузите в корень репозитория всё содержимое ZIP, а не сам ZIP.
  Сохраните папку assets и layout-v17.css.
  Подождите публикации, затем обновите сайт и отправьте тестовую заявку.

Установлен публичный Turnstile Site Key, предоставленный владельцем:
  0x4AAAAAAFaEaNjkspeaP-Uw
Turnstile настроен на hostname arseniy-cyber.github.io и action booking.
Если сайт переедет на другой домен, добавьте его в настройках виджета,
затем обновите разрешённый адрес (ALLOWED_ORIGIN) в Worker при необходимости.

Для проверки не открывайте index.html через file:// — Turnstile требуется HTTPS.
Фото по-прежнему отправляются в Telegram файлами без сжатия.
При ошибке Cloudflare проверку можно повторить; одноразовый токен сбрасывается.

Примечание: Turnstile снижает спам, но не заменяет лимиты заявок по IP.
Для надёжного ограничения частоты отдельно настройте Rate Limiting
на Workers (или хранилище счётчиков). Перед сбором заявок необходимо
обеспечить соблюдение правил обработки персональных данных.
