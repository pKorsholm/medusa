import {
  AdminNotificationsRes,
  AdminPostNotificationsNotificationResendReq,
} from "@pkorsholm/medusa"
import { Response } from "@pkorsholm/medusa-js"
import { useMutation, UseMutationOptions, useQueryClient } from "react-query"
import { useMedusa } from "../../../contexts/medusa"
import { adminNotificationKeys } from "./queries"
import { buildOptions } from "../../utils/buildOptions"

export const useAdminResendNotification = (
  id: string,
  options?: UseMutationOptions<
    Response<AdminNotificationsRes>,
    Error,
    AdminPostNotificationsNotificationResendReq
  >
) => {
  const { client } = useMedusa()
  const queryClient = useQueryClient()

  return useMutation(
    (payload: AdminPostNotificationsNotificationResendReq) =>
      client.admin.notifications.resend(id, payload),
    buildOptions(
      queryClient,
      [adminNotificationKeys.lists(), adminNotificationKeys.detail(id)],
      options
    )
  )
}
