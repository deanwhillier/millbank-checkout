import {IAddressType, ICustomer, IDiscount, ILineItem} from '@boldcommerce/checkout-frontend-library';

type UserData = Record<string, unknown>;

function clean(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalises a North American phone number to E.164 (+1XXXXXXXXXX).
 * Digits only, one leading "1" stripped when there are 11 digits, exactly 10 digits required.
 * Anything else returns '' so the caller omits the field.
 */
export function toE164(phone: unknown): string {
    let digits = clean(phone).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
    }
    return digits.length === 10 ? `+1${digits}` : '';
}

/**
 * Enhanced-conversion user data in Google's schema. Values are not hashed (gtag hashes them).
 * Empty or invalid fields are omitted, and `address` is omitted when it ends up empty.
 */
export function formatGoogleAdsUserData(customer: ICustomer, addresses: IAddressType): UserData {
    const billing = addresses?.billing;
    const userData: UserData = {};

    const email = clean(customer?.email_address).toLowerCase();
    if (email) {
        userData.email = email;
    }

    const phone = toE164(billing?.phone_number);
    if (phone) {
        userData.phone_number = phone;
    }

    const country = clean(billing?.country_code);
    const address: Record<string, string> = {};
    const fields: Record<string, string> = {
        first_name: clean(billing?.first_name) || clean(customer?.first_name),
        last_name: clean(billing?.last_name) || clean(customer?.last_name),
        street: clean(billing?.address_line_1),
        city: clean(billing?.city),
        region: clean(billing?.province_code),
        postal_code: clean(billing?.postal_code),
        country: /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : '',
    };
    Object.keys(fields).forEach(key => {
        if (fields[key]) {
            address[key] = fields[key];
        }
    });
    if (Object.keys(address).length > 0) {
        userData.address = address;
    }

    return userData;
}

/**
 * Conversion value in dollars (a number, 2 dp, never negative): the sum of qty x unit price for
 * product lines, minus product/order discounts. Line-item fees, tax and shipping are excluded.
 * Shipping discounts are excluded too, because BOLD keeps them in `shipping.discounts`, which this
 * helper never sees. Amounts from BOLD are in cents.
 */
export function getGoogleAdsConversionValue(lineItems: Array<ILineItem>, discounts: Array<IDiscount>): number {
    const subtotal = (lineItems ?? []).reduce((sum, item) => {
        const quantity = Number(item.product_data?.quantity) || 0;
        const price = Number(item.product_data?.price) || 0;
        return sum + quantity * price;
    }, 0);
    const discountTotal = (discounts ?? [])
        .reduce((sum, discount) => sum + (Number(discount.value) || 0), 0);

    return Math.max(0, Math.round(subtotal - discountTotal)) / 100;
}

export function orderCompleteForGoogleAds(
    customer: ICustomer,
    addresses: IAddressType,
    lineItems: Array<ILineItem>,
    currency: string,
    discounts: Array<IDiscount>,
    id: string
): void {
    try {
        const adsId = clean(window.GOOGLE_ADS?.id);
        const purchaseLabel = clean(window.GOOGLE_ADS?.purchaseLabel);
        if (!adsId || !purchaseLabel || typeof window['gtag'] !== 'function') {
            return;
        }

        // Skip an empty user_data object; the conversion itself is still sent.
        const userData = formatGoogleAdsUserData(customer, addresses);
        if (Object.keys(userData).length > 0) {
            window['gtag']('set', 'user_data', userData);
        }
        window['gtag']('event', 'conversion', {
            send_to: `${adsId}/${purchaseLabel}`,
            value: getGoogleAdsConversionValue(lineItems, discounts),
            currency,
            transaction_id: id,
        });
    } catch (e) {
        // Analytics must never break the order-complete flow.
    }
}
