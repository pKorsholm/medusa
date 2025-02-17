import { MedusaError } from "@pkorsholm/medusa-core-utils"
import { EntityManager } from "typeorm"
import { ProductVariantService, RegionService, TaxProviderService } from "."
import { TransactionBaseService } from "../interfaces"
import {
  IPriceSelectionStrategy,
  PriceSelectionContext,
} from "../interfaces/price-selection-strategy"
import TaxInclusivePricingFeatureFlag from "../loaders/feature-flags/tax-inclusive-pricing"
import { Product, ProductVariant, ShippingOption } from "../models"
import {
  PricedProduct,
  PricedShippingOption,
  PricedVariant,
  PricingContext,
  ProductVariantPricing,
  TaxedPricing,
} from "../types/pricing"
import { TaxServiceRate } from "../types/tax-service"
import { calculatePriceTaxAmount } from "../utils"
import { FlagRouter } from "../utils/flag-router"

type InjectedDependencies = {
  manager: EntityManager
  productVariantService: ProductVariantService
  taxProviderService: TaxProviderService
  regionService: RegionService
  priceSelectionStrategy: IPriceSelectionStrategy
  featureFlagRouter: FlagRouter
}

/**
 * Allows retrieval of prices.
 */
class PricingService extends TransactionBaseService {
  protected manager_: EntityManager
  protected transactionManager_: EntityManager | undefined
  protected readonly regionService: RegionService
  protected readonly taxProviderService: TaxProviderService
  protected readonly priceSelectionStrategy: IPriceSelectionStrategy
  protected readonly productVariantService: ProductVariantService
  protected readonly featureFlagRouter: FlagRouter

  constructor({
    manager,
    productVariantService,
    taxProviderService,
    regionService,
    priceSelectionStrategy,
    featureFlagRouter,
  }: InjectedDependencies) {
    // eslint-disable-next-line prefer-rest-params
    super(arguments[0])

    this.manager_ = manager
    this.regionService = regionService
    this.taxProviderService = taxProviderService
    this.priceSelectionStrategy = priceSelectionStrategy
    this.productVariantService = productVariantService
    this.featureFlagRouter = featureFlagRouter
  }

  /**
   * Collects additional information neccessary for completing the price
   * selection.
   * @param context - the price selection context to use
   * @return The pricing context
   */
  async collectPricingContext(
    context: PriceSelectionContext
  ): Promise<PricingContext> {
    let automaticTaxes = false
    let taxRate: number | null = null
    let currencyCode = context.currency_code

    if (context.region_id) {
      const region = await this.regionService
        .withTransaction(this.manager_)
        .retrieve(context.region_id, {
          select: ["id", "currency_code", "automatic_taxes", "tax_rate"],
        })

      currencyCode = region.currency_code
      automaticTaxes = region.automatic_taxes
      taxRate = region.tax_rate
    }

    return {
      price_selection: {
        ...context,
        currency_code: currencyCode,
      },
      automatic_taxes: automaticTaxes,
      tax_rate: taxRate,
    }
  }

  /**
   * Gets the prices for a product variant
   * @param variantPricing - the prices retrieved from a variant
   * @param productRates - the tax rates that the product has applied
   * @return The tax related variant prices.
   */
  async calculateTaxes(
    variantPricing: ProductVariantPricing,
    productRates: TaxServiceRate[]
  ): Promise<TaxedPricing> {
    const rate = productRates.reduce(
      (accRate: number, nextTaxRate: TaxServiceRate) => {
        return accRate + (nextTaxRate.rate || 0) / 100
      },
      0
    )

    const taxedPricing: TaxedPricing = {
      original_tax: null,
      calculated_tax: null,
      original_price_incl_tax: null,
      calculated_price_incl_tax: null,
      tax_rates: productRates,
    }

    if (variantPricing.calculated_price !== null) {
      const includesTax = !!(
        this.featureFlagRouter.isFeatureEnabled(
          TaxInclusivePricingFeatureFlag.key
        ) && variantPricing.calculated_price_includes_tax
      )
      taxedPricing.calculated_tax = Math.round(
        calculatePriceTaxAmount({
          price: variantPricing.calculated_price,
          taxRate: rate,
          includesTax,
        })
      )

      taxedPricing.calculated_price_incl_tax =
        variantPricing.calculated_price_includes_tax
          ? variantPricing.calculated_price
          : variantPricing.calculated_price + taxedPricing.calculated_tax
    }

    if (variantPricing.original_price !== null) {
      const includesTax = !!(
        this.featureFlagRouter.isFeatureEnabled(
          TaxInclusivePricingFeatureFlag.key
        ) && variantPricing.original_price_includes_tax
      )
      taxedPricing.original_tax = Math.round(
        calculatePriceTaxAmount({
          price: variantPricing.original_price,
          taxRate: rate,
          includesTax,
        })
      )

      taxedPricing.original_price_incl_tax =
        variantPricing.original_price_includes_tax
          ? variantPricing.original_price
          : variantPricing.original_price + taxedPricing.original_tax
    }

    return taxedPricing
  }

  private async getProductVariantPricing_(
    variantId: string,
    taxRates: TaxServiceRate[],
    context: PricingContext
  ): Promise<ProductVariantPricing> {
    const transactionManager = this.transactionManager_ ?? this.manager_

    context.price_selection.tax_rates = taxRates

    const pricing = await this.priceSelectionStrategy
      .withTransaction(transactionManager)
      .calculateVariantPrice(variantId, context.price_selection)

    const pricingResult: ProductVariantPricing = {
      prices: pricing.prices,
      original_price: pricing.originalPrice,
      calculated_price: pricing.calculatedPrice,
      calculated_price_type: pricing.calculatedPriceType,
      original_price_includes_tax: pricing.originalPriceIncludesTax,
      calculated_price_includes_tax: pricing.calculatedPriceIncludesTax,
      original_price_incl_tax: null,
      calculated_price_incl_tax: null,
      original_tax: null,
      calculated_tax: null,
      tax_rates: null,
    }

    if (context.automatic_taxes && context.price_selection.region_id) {
      const taxResults = await this.calculateTaxes(pricingResult, taxRates)

      pricingResult.original_price_incl_tax = taxResults.original_price_incl_tax
      pricingResult.calculated_price_incl_tax =
        taxResults.calculated_price_incl_tax
      pricingResult.original_tax = taxResults.original_tax
      pricingResult.calculated_tax = taxResults.calculated_tax
      pricingResult.tax_rates = taxResults.tax_rates
    }

    return pricingResult
  }

  /**
   * Gets the prices for a product variant.
   * @param variant - the id of the variant to get prices for
   * @param context - the price selection context to use
   * @return The product variant prices
   */
  async getProductVariantPricing(
    variant: Pick<ProductVariant, "id" | "product_id">,
    context: PriceSelectionContext | PricingContext
  ): Promise<ProductVariantPricing> {
    let pricingContext: PricingContext
    if ("automatic_taxes" in context) {
      pricingContext = context
    } else {
      pricingContext = await this.collectPricingContext(context)
    }

    let productRates: TaxServiceRate[] = []
    if (
      pricingContext.automatic_taxes &&
      pricingContext.price_selection.region_id
    ) {
      productRates = await this.taxProviderService.getRegionRatesForProduct(
        variant.product_id,
        {
          id: pricingContext.price_selection.region_id,
          tax_rate: pricingContext.tax_rate,
        }
      )
    }

    return await this.getProductVariantPricing_(
      variant.id,
      productRates,
      pricingContext
    )
  }

  /**
   * Gets the prices for a product variant by a variant id.
   * @param variantId - the id of the variant to get prices for
   * @param context - the price selection context to use
   * @return The product variant prices
   */
  async getProductVariantPricingById(
    variantId: string,
    context: PriceSelectionContext | PricingContext
  ): Promise<ProductVariantPricing> {
    let pricingContext: PricingContext
    if ("automatic_taxes" in context) {
      pricingContext = context
    } else {
      pricingContext = await this.collectPricingContext(context)
    }

    let productRates: TaxServiceRate[] = []
    if (
      pricingContext.automatic_taxes &&
      pricingContext.price_selection.region_id
    ) {
      const { product_id } = await this.productVariantService
        .withTransaction(this.manager_)
        .retrieve(variantId, { select: ["id", "product_id"] })
      productRates = await this.taxProviderService
        .withTransaction(this.manager_)
        .getRegionRatesForProduct(product_id, {
          id: pricingContext.price_selection.region_id,
          tax_rate: pricingContext.tax_rate,
        })
    }

    return await this.getProductVariantPricing_(
      variantId,
      productRates,
      pricingContext
    )
  }

  private async getProductPricing_(
    productId: string,
    variants: ProductVariant[],
    context: PricingContext
  ): Promise<Record<string, ProductVariantPricing>> {
    const transactionManager = this.transactionManager_ ?? this.manager_
    let taxRates: TaxServiceRate[] = []
    if (context.automatic_taxes && context.price_selection.region_id) {
      taxRates = await this.taxProviderService
        .withTransaction(transactionManager)
        .getRegionRatesForProduct(productId, {
          id: context.price_selection.region_id,
          tax_rate: context.tax_rate,
        })
    }

    const pricings = {}
    await Promise.all(
      variants.map(async ({ id }) => {
        const variantPricing = await this.getProductVariantPricing_(
          id,
          taxRates,
          context
        )
        pricings[id] = variantPricing
      })
    )

    return pricings
  }

  /**
   * Gets all the variant prices for a product. All the product's variants will
   * be fetched.
   * @param product - the product to get pricing for.
   * @param context - the price selection context to use
   * @return A map of variant ids to their corresponding prices
   */
  async getProductPricing(
    product: Pick<Product, "id" | "variants">,
    context: PriceSelectionContext
  ): Promise<Record<string, ProductVariantPricing>> {
    const pricingContext = await this.collectPricingContext(context)
    return await this.getProductPricing_(
      product.id,
      product.variants,
      pricingContext
    )
  }

  /**
   * Gets all the variant prices for a product by the product id
   * @param productId - the id of the product to get prices for
   * @param context - the price selection context to use
   * @return A map of variant ids to their corresponding prices
   */
  async getProductPricingById(
    productId: string,
    context: PriceSelectionContext
  ): Promise<Record<string, ProductVariantPricing>> {
    const pricingContext = await this.collectPricingContext(context)
    const variants = await this.productVariantService.list(
      { product_id: productId },
      { select: ["id"] }
    )
    return await this.getProductPricing_(productId, variants, pricingContext)
  }

  /**
   * Set additional prices on a list of product variants.
   * @param variants - list of variants on which to set additional prices
   * @param context - the price selection context to use
   * @return A list of products with variants decorated with prices
   */
  async setVariantPrices(
    variants: ProductVariant[],
    context: PriceSelectionContext
  ): Promise<PricedVariant[]> {
    const pricingContext = await this.collectPricingContext(context)
    return await Promise.all(
      variants.map(async (variant) => {
        const variantPricing = await this.getProductVariantPricing(
          variant,
          pricingContext
        )
        return {
          ...variant,
          ...variantPricing,
        }
      })
    )
  }

  /**
   * Set additional prices on a list of products.
   * @param products - list of products on which to set additional prices
   * @param context - the price selection context to use
   * @return A list of products with variants decorated with prices
   */
  async setProductPrices(
    products: Product[],
    context: PriceSelectionContext = {}
  ): Promise<(Product | PricedProduct)[]> {
    const pricingContext = await this.collectPricingContext(context)
    return await Promise.all(
      products.map(async (product) => {
        if (!product?.variants?.length) {
          return product
        }

        const variantPricing = await this.getProductPricing_(
          product.id,
          product.variants,
          pricingContext
        )

        const pricedVariants = product.variants.map(
          (productVariant): PricedVariant => {
            const pricing = variantPricing[productVariant.id]
            return {
              ...productVariant,
              ...pricing,
            }
          }
        )

        const pricedProduct = {
          ...product,
          variants: pricedVariants,
        }

        return pricedProduct
      })
    )
  }

  /**
   * Gets the prices for a shipping option.
   * @param shippingOption - the shipping option to get prices for
   * @param context - the price selection context to use
   * @return The shipping option prices
   */
  async getShippingOptionPricing(
    shippingOption: ShippingOption,
    context: PriceSelectionContext | PricingContext
  ): Promise<PricedShippingOption> {
    let pricingContext: PricingContext
    if ("automatic_taxes" in context) {
      pricingContext = context
    } else {
      pricingContext = await this.collectPricingContext(context)
    }

    let shippingOptionRates: TaxServiceRate[] = []
    if (
      pricingContext.automatic_taxes &&
      pricingContext.price_selection.region_id
    ) {
      shippingOptionRates = await this.taxProviderService
        .withTransaction(this.manager_)
        .getRegionRatesForShipping(shippingOption.id, {
          id: pricingContext.price_selection.region_id,
          tax_rate: pricingContext.tax_rate,
        })
    }

    const price = shippingOption.amount || 0
    const rate = shippingOptionRates.reduce(
      (accRate: number, nextTaxRate: TaxServiceRate) => {
        return accRate + (nextTaxRate.rate || 0) / 100
      },
      0
    )

    const includesTax =
      this.featureFlagRouter.isFeatureEnabled(
        TaxInclusivePricingFeatureFlag.key
      ) && shippingOption.includes_tax

    const taxAmount = Math.round(
      calculatePriceTaxAmount({
        taxRate: rate,
        price,
        includesTax,
      })
    )
    const totalInclTax = includesTax ? price : price + taxAmount

    const result: PricedShippingOption = {
      ...shippingOption,
      price_incl_tax: totalInclTax,
      tax_rates: shippingOptionRates,
      tax_amount: taxAmount,
    }

    return result
  }

  /**
   * Set additional prices on a list of shipping options.
   * @param shippingOptions - list of shipping options on which to set additional prices
   * @param context - the price selection context to use
   * @return A list of shipping options with prices
   */
  async setShippingOptionPrices(
    shippingOptions: ShippingOption[],
    context: Omit<PriceSelectionContext, "region_id"> = {}
  ): Promise<PricedShippingOption[]> {
    const regions = new Set<string>()

    for (const shippingOption of shippingOptions) {
      regions.add(shippingOption.region_id)
    }

    const contexts = await Promise.all(
      [...regions].map(async (regionId) => {
        return {
          context: await this.collectPricingContext({
            ...context,
            region_id: regionId,
          }),
          region_id: regionId,
        }
      })
    )

    return await Promise.all(
      shippingOptions.map(async (shippingOption) => {
        const pricingContext = contexts.find(
          (c) => c.region_id === shippingOption.region_id
        )

        if (!pricingContext) {
          throw new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            "Could not find pricing context for shipping option"
          )
        }

        const shippingOptionPricing = await this.getShippingOptionPricing(
          shippingOption,
          pricingContext.context
        )
        return {
          ...shippingOption,
          ...shippingOptionPricing,
        }
      })
    )
  }
}

export default PricingService
