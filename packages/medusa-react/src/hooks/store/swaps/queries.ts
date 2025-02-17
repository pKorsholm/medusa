import { queryKeysFactory } from "../../utils/index"
import { StoreSwapsRes } from "@pkorsholm/medusa"
import { Response } from "@pkorsholm/medusa-js"
import { useQuery } from "react-query"
import { useMedusa } from "../../../contexts"
import { UseQueryOptionsWrapper } from "../../../types"

const SWAPS_QUERY_KEY = `swaps` as const

const swapKey = {
  ...queryKeysFactory(SWAPS_QUERY_KEY),
  cart: (cartId: string) => [...swapKey.all, "cart", cartId] as const,
}

type SwapQueryKey = typeof swapKey

export const useCartSwap = (
  cartId: string,
  options?: UseQueryOptionsWrapper<
    Response<StoreSwapsRes>,
    Error,
    ReturnType<SwapQueryKey["cart"]>
  >
) => {
  const { client } = useMedusa()
  const { data, ...rest } = useQuery(
    swapKey.cart(cartId),
    () => client.swaps.retrieveByCartId(cartId),
    options
  )

  return { ...data, ...rest } as const
}
