import { IdMap } from "@pkorsholm/medusa-test-utils"
import { request } from "../../../../../helpers/test-request"
import OrderEditingFeatureFlag from "../../../../../loaders/feature-flags/order-editing"
import { orderEditServiceMock } from "../../../../../services/__mocks__/order-edit"

describe("POST /admin/order-edits/:id/confirm", () => {
  describe("confirms an order edit", () => {
    const orderEditId = IdMap.getId("testConfirmOrderEdit")
    let subject

    beforeAll(async () => {
      subject = await request(
        "POST",
        `/admin/order-edits/${orderEditId}/confirm`,
        {
          adminSession: {
            jwt: {
              userId: "admin_user",
            },
          },
          flags: [OrderEditingFeatureFlag],
        }
      )
    })

    afterAll(() => {
      jest.clearAllMocks()
    })

    it("calls orderService confirm", () => {
      expect(orderEditServiceMock.confirm).toHaveBeenCalledTimes(1)
      expect(orderEditServiceMock.confirm).toHaveBeenCalledWith(orderEditId, {
        loggedInUserId: "admin_user",
      })
    })

    it("returns 200", () => {
      expect(subject.status).toEqual(200)
    })

    it("returns confirm result", () => {
      expect(subject.body.order_edit).toEqual(
        expect.objectContaining({
          id: orderEditId,
          confirmed_at: expect.any(String),
          confirmed_by: "admin_user",
          status: "confirmed",
        })
      )
    })
  })
})
