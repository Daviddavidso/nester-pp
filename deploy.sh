#!/usr/bin/env bash
# Публикация сайта maeb-fin.ru (GitHub Pages, репозиторий Daviddavidso/nester-pp).
#
#   bash deploy.sh "что поменяли"
#
# Обычный git push в этом окружении подвисает: глобального хранилища паролей
# нет, и git уходит спрашивать логин в никуда. Поэтому ключи берём у gh.
set -euo pipefail
cd "$(dirname "$0")"

MSG="${1:-Обновление сайта}"
export GIT_TERMINAL_PROMPT=0
GITC=(git -c credential.helper='!gh auth git-credential')

# Клиент сам сохраняет data.js из админки — это коммиты прямо в GitHub.
# Сначала забираем их, иначе пуш не пройдёт или затрёт его каталог.
"${GITC[@]}" pull -q --rebase --autostash origin main

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -q -m "$MSG

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  echo "Коммит сделан: $MSG"
else
  echo "Менять нечего — рабочая копия чистая."
fi

"${GITC[@]}" push origin main
echo
echo "Ушло на GitHub. Pages пересобирает страницу 1–3 минуты."
echo "Проверить:  curl -sI http://maeb-fin.ru | head -1"
