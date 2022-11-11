import { StoreSwapsRes, StorePostSwapsReq } from "@pkorsholm/medusa"
import { useMutation, UseMutationOptions } from "react-query"
import { useMedusa } from "../../../contexts"

export const useCreateSwap = (
  options?: UseMutationOptions<StoreSwapsRes, Error, StorePostSwapsReq>
) => {
  const { client } = useMedusa()
  return useMutation(
    (data: StorePostSwapsReq) => client.swaps.create(data),
    options
  )
}
