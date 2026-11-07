/** Отправка СМС. Телефон — в E.164 (`+7XXXXXXXXXX`). */
export interface SmsProvider {
  send(phoneE164: string, text: string): Promise<void>
}
