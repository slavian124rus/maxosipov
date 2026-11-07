# Вход через Яндекс ID и VK ID: настройка приложений

Документ для владельца: что создать, какие адреса указать, какие права запросить.
Точные адреса и поля — сверены с официальной документацией (см. ссылки в конце).

## 1. Яндекс ID

### Создать приложение

1. <https://oauth.yandex.ru/> → «Создать приложение».
2. Платформа: **Веб-сервисы**.
3. Redirect URI (можно несколько, по одному в строке):
   - `https://app.maxosipov.ru/api/auth/yandex/callback`
   - `http://app.localhost:3000/api/auth/yandex/callback` (для разработки)
4. Доступы: **`login:default_phone`** (телефон), `login:info` (имя), `login:email` — по желанию.
   Без `login:default_phone` провайдер не отдаст номер, и человек попадёт на экран
   «Подтверди номер».
5. Из свойств приложения взять **ClientID** и **Client secret** → в `.env`:
   `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`.

### Как устроен обмен (по документации)

| Шаг | Запрос |
|---|---|
| Авторизация | `GET https://oauth.yandex.ru/authorize?response_type=code&client_id=…&redirect_uri=…&scope=…&state=…&code_challenge=…&code_challenge_method=S256` |
| Токен | `POST https://oauth.yandex.ru/token`, тело `application/x-www-form-urlencoded`: `grant_type=authorization_code`, `code`, `client_id`, `client_secret`, `redirect_uri`, `code_verifier` |
| Профиль | `GET https://login.yandex.ru/info?format=json`, заголовок `Authorization: OAuth <access_token>` |

Поля ответа профиля: `id`, `real_name` / `display_name`, `default_phone.number`.
Ответ токена: `access_token`, `expires_in`, `refresh_token`, `scope`; ошибка — `error`, `error_description`.

## 2. VK ID

### Создать приложение

1. <https://id.vk.com/about/business/go> → кабинет → «Создать приложение» (тип «Веб»).
2. Redirect URI:
   - `https://app.maxosipov.ru/api/auth/vk/callback`
   - `http://app.localhost:3000/api/auth/vk/callback` (для разработки)
3. Права: **телефон** (`scope=phone`).
4. Взять **ID приложения** и **защищённый ключ** → в `.env`: `VK_CLIENT_ID`, `VK_CLIENT_SECRET`.

### Как устроен обмен (по документации)

| Шаг | Запрос |
|---|---|
| Авторизация | `GET https://id.vk.ru/authorize?response_type=code&client_id=…&redirect_uri=…&state=…&code_challenge=…&code_challenge_method=S256&scope=phone` |
| Токен | `POST https://id.vk.com/oauth2/auth`, тело `x-www-form-urlencoded`: `grant_type=authorization_code`, `code`, `code_verifier`, `device_id`, `redirect_uri`, `client_id`, `client_secret`, `state` |
| Профиль | `POST https://id.vk.com/oauth2/user_info`, тело: `client_id`, `access_token` |

В callback VK приходит не только `code` и `state`, но и `device_id` — без него обмен кода
на токен не пройдёт. Ответ профиля: `user.user_id`, `user.first_name`, `user.last_name`,
`user.phone`; ошибка — `error`, `error_description`.

### Расхождение с планом

В плане этапа 1 адрес авторизации указан как `https://id.vk.com/authorize`,
в актуальной документации VK ID пример — **`https://id.vk.ru/authorize`**.
В коде используется адрес из документации (`id.vk.ru`), обмен токена и профиль — `id.vk.com`.
Если VK вернёт ошибку на шаге авторизации — в первую очередь проверить этот адрес
(константы `VK_AUTHORIZE`, `VK_TOKEN`, `VK_USER_INFO` в `src/modules/auth/oauth/vk.ts`).

## 3. Проверка после заполнения `.env`

```bash
pnpm dev
# открыть http://app.localhost:3000/login — кнопки появятся, когда заданы ключи
```

Если ключей нет, кнопки «Войти через VK ID» / «Войти через Яндекс ID» не показываются,
а вход по номеру телефона работает всегда.

## Ссылки

- Яндекс ID: <https://yandex.ru/dev/id/doc/ru/codes/code-url>
- VK ID API: <https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-description>
