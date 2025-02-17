import { TransactionBaseService } from "./transaction-base-service"
import BaseNotificationService from "@pkorsholm/medusa-interfaces/dist/notification-service"

type ReturnedData = {
  to: string
  status: string
  data: Record<string, unknown>
}

export interface INotificationService extends TransactionBaseService {
  sendNotification(
    event: string,
    data: unknown,
    attachmentGenerator: unknown
  ): Promise<ReturnedData>

  resendNotification(
    notification: unknown,
    config: unknown,
    attachmentGenerator: unknown
  ): Promise<ReturnedData>
}

export abstract class AbstractNotificationService
  extends TransactionBaseService
  implements INotificationService
{
  static identifier: string

  getIdentifier(): string {
    return (this.constructor as any).identifier
  }

  abstract sendNotification(
    event: string,
    data: unknown,
    attachmentGenerator: unknown
  ): Promise<ReturnedData>

  abstract resendNotification(
    notification: unknown,
    config: unknown,
    attachmentGenerator: unknown
  ): Promise<ReturnedData>
}

export const isNotificationService = (obj: unknown): boolean => {
  return (
    obj instanceof AbstractNotificationService ||
    obj instanceof BaseNotificationService
  )
}
