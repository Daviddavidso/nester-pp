# Сервис «Сохранить на сайт» (Vercel)

Серверная функция публикации для админки maeb-fin.ru. Пока **не развёрнута**:
админка это понимает и работает в ручном режиме — «Сохранить на сайт»
скачивает `data.js`, чтобы клиент прислал файл разработчику.

Разворачивается на Vercel проектом с именем **maeb-publish** — именно с этим,
адрес `https://maeb-publish.vercel.app/api/publish` прописан в `admin.html`.

Настройка после деплоя — одна переменная окружения в Settings → Environment
Variables:

- `GH_TOKEN` — fine-grained personal access token GitHub с доступом ТОЛЬКО
  к репозиторию `Daviddavidso/nester-pp`, право **Contents: Read and write**.
  Создать: github.com → Settings → Developer settings → Fine-grained tokens.

После добавления переменной сделать Redeploy. Пока переменной нет, вход в
панель работает, а сохранение вежливо отказывает.

Секретов в коде нет: эталон пароля — файл `.admin-pass` из этого репозитория
(sha256 от соли и пароля, сам пароль из него не восстановить), ключ подписи
токенов выводится из `GH_TOKEN`.
