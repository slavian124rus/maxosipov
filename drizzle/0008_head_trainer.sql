-- Главный тренер в настройках зала (ревью F6): берём первого пользователя с ролью «Главный тренер»,
-- если в настройках его ещё нет. Новые клиенты получают trainer_id отсюда.
UPDATE "gyms" g
SET "settings" = g."settings" || jsonb_build_object('headTrainerId', t.id)
FROM (
  SELECT DISTINCT ON (u.gym_id) u.id, u.gym_id
  FROM "users" u
  JOIN "roles" r ON r.id = u.role_id
  WHERE r.name = 'Главный тренер'
  ORDER BY u.gym_id, u.created_at
) t
WHERE t.gym_id = g.id
  AND NOT (g."settings" ? 'headTrainerId');
