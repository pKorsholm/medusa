import { IdMap } from "@pkorsholm/medusa-test-utils"
import { request } from "../../../../../helpers/test-request"
import { orderEditServiceMock } from "../../../../../services/__mocks__/order-edit"
import OrderEditingFeatureFlag from "../../../../../loaders/feature-flags/order-editing"

describe("POST /admin/order-edits", () => {
  describe("successfully create an order edit", () => {
    const orderId = IdMap.getId("order-edit-order-id-test")
    const internalNote = "test internal note"
    let subject

    beforeAll(async () => {
      subject = await request("POST", "/admin/order-edits", {
        payload: {
          order_id: orderId,
          internal_note: internalNote,
        },
        adminSession: {
          jwt: {
            userId: IdMap.getId("admin_user"),
          },
        },
        flags: [OrderEditingFeatureFlag],
      })
    })

    afterAll(async () => {
      jest.clearAllMocks()
    })

    it("returns 200", () => {
      expect(subject.status).toEqual(200)
    })

    it("calls order edit service create", () => {
      expect(orderEditServiceMock.decorateTotals).toHaveBeenCalledTimes(1)
      expect(orderEditServiceMock.create).toHaveBeenCalledTimes(1)
      expect(orderEditServiceMock.create).toHaveBeenCalledWith(
        {
          order_id: orderId,
          internal_note: internalNote,
        },
        {
          loggedInUserId: IdMap.getId("admin_user"),
        }
      )
    })
  })
})
