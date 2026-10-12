#!/usr/bin/env bash
# Подключить «Сохранить на сайт» в админке maeb-fin.ru — один раз.
#
#   bash tools/connect-github.sh
#
# 1. Откроется GitHub со страницей нового токена (всё уже заполнено).
#    Там: Repository access → Only select repositories → nester-pp,
#    внизу Generate token, скопировать токен.
# 2. Вернуться сюда, вставить токен, Enter (ввод скрыт).
# 3. Скрипт проверит токен, зашифрует его паролем админки и выложит на сайт.
set -euo pipefail
cd "$(dirname "$0")/.."

URL='https://github.com/settings/personal-access-tokens/new?name=maeb-fin+admin&description=%D0%A1%D0%BE%D1%85%D1%80%D0%B0%D0%BD%D0%B5%D0%BD%D0%B8%D0%B5+%D0%BA%D0%B0%D1%82%D0%B0%D0%BB%D0%BE%D0%B3%D0%B0+%D0%B8%D0%B7+%D0%B0%D0%B4%D0%BC%D0%B8%D0%BD%D0%BA%D0%B8+maeb-fin.ru&target_name=Daviddavidso&expires_in=none&contents=write'

echo "Открываю GitHub. На странице токена:"
echo "  • Repository access → Only select repositories → выбрать nester-pp"
echo "  • Права уже выставлены: Contents — Read and write"
echo "  • Внизу Generate token → скопировать токен (github_pat_…)"
echo
open "$URL" 2>/dev/null || echo "Откройте вручную: $URL"

node tools/publish-key.mjs token
node tools/publish-key.mjs check
bash deploy.sh "Ключ сохранения на сайт"
echo
echo "Готово. Через 1–2 минуты кнопка «Сохранить на сайт» в админке заработает."
