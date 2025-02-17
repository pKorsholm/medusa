import {
  AdminOrderEditsListRes,
  AdminOrderEditsRes,
  GetOrderEditsOrderEditParams,
  GetOrderEditsParams,
} from "@pkorsholm/medusa"
import { queryKeysFactory } from "../../utils"
import { UseQueryOptionsWrapper } from "../../../types"
import { Response } from "@pkorsholm/medusa-js"
import { useMedusa } from "../../../contexts"
import { useQuery } from "react-query"

const ADMIN_ORDER_EDITS_QUERY_KEY = `admin_order_edits` as const

export const adminOrderEditsKeys = queryKeysFactory(ADMIN_ORDER_EDITS_QUERY_KEY)
type OrderEditQueryKeys = typeof adminOrderEditsKeys

export const useAdminOrderEdit = (
  id: string,
  query?: GetOrderEditsOrderEditParams,
  options?: UseQueryOptionsWrapper<
    Response<AdminOrderEditsRes>,
    Error,
    ReturnType<OrderEditQueryKeys["detail"]>
  >
) => {
  const { client } = useMedusa()
  const { data, ...rest } = useQuery(
    adminOrderEditsKeys.detail(id),
    () => client.admin.orderEdits.retrieve(id, query),
    options
  )
  return { ...data, ...rest } as const
}

export const useAdminOrderEdits = (
  query?: GetOrderEditsParams,
  options?: UseQueryOptionsWrapper<
    Response<AdminOrderEditsListRes>,
    Error,
    ReturnType<OrderEditQueryKeys["list"]>
  >
) => {
  const { client } = useMedusa()
  const { data, ...rest } = useQuery(
    adminOrderEditsKeys.list(query),
    () => client.admin.orderEdits.list(query),
    options
  )
  return { ...data, ...rest } as const
}
