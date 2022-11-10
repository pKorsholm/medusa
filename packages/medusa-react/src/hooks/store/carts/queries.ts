import { queryKeysFactory } from "../../utils/index"
import { StoreCartsRes } from "@pkorsholm/medusa"
import { Response } from "@pkorsholm/medusa-js"
import { useQuery } from "react-query"
import { useMedusa } from "../../../contexts/medusa"
import { UseQueryOptionsWrapper } from "../../../types"

const CARTS_QUERY_KEY = `carts` as const

export const cartKeys = queryKeysFactory(CARTS_QUERY_KEY)
type CartQueryKey = typeof cartKeys

export const useGetCart = (
  id: string,
  options?: UseQueryOptionsWrapper<
    Response<StoreCartsRes>,
    Error,
    ReturnType<CartQueryKey["detail"]>
  >
) => {
  const { client } = useMedusa()
  const { data, ...rest } = useQuery(
    cartKeys.detail(id),
    () => client.carts.retrieve(id),
    options
  )
  return { ...data, ...rest } as const
}
