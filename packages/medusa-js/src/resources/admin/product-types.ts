import {
  AdminGetProductTypesParams,
  AdminProductTypesListRes,
} from "@pkorsholm/medusa"
import qs from "qs"
import { ResponsePromise } from "../../typings"
import BaseResource from "../base"

class AdminProductTypesResource extends BaseResource {
  list(
    query?: AdminGetProductTypesParams
  ): ResponsePromise<AdminProductTypesListRes> {
    let path = `/admin/product-types`

    if (query) {
      const queryString = qs.stringify(query)
      path = `/admin/product-types?${queryString}`
    }

    return this.client.request("GET", path)
  }
}

export default AdminProductTypesResource
