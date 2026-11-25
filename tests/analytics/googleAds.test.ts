import {IAddressType, ICustomer, IDiscount, ILineItem, IShippingLine} from '@boldcommerce/checkout-frontend-library';
import {
    formatGoogleAdsUserData,
    getGoogleAdsConversionValue,
    orderCompleteAnalytics,
    orderCompleteForGoogleAds,
    toE164,
} from 'src/analytics';
import {ITotals} from 'src/types';

const makeLine = (price: number, quantity = 1, fees: Array<{amount: number, name: string}> = []): ILineItem => ({
    product_data: {sku: `sku-${price}`, product_title: 'Product', title: 'Variant', price, quantity},
    taxes: [],
    fees,
    discounts: [],
} as unknown as ILineItem);

const makeDiscount = (value: number, code = 'CODE', text = 'Some discount'): IDiscount => ({code, text, value, valid: true});

const customer = {
    platform_id: null,
    public_id: null,
    first_name: 'Cust',
    last_name: 'Omer',
    email_address: '  Test.User@Example.COM ',
    accepts_marketing: false,
    saved_addresses: [],
} as ICustomer;

const makeAddresses = (billing: Record<string, string> = {}): IAddressType => ({
    billing: {
        first_name: 'Ada',
        last_name: 'Lovelace',
        address_line_1: '1 Test Street',
        address_line_2: '',
        city: 'Toronto',
        province: 'Ontario',
        province_code: 'ON',
        postal_code: 'M5V 1A1',
        country: 'Canada',
        country_code: 'ca',
        business_name: '',
        phone_number: '(416) 555-0123',
        ...billing,
    },
    shipping: {},
} as unknown as IAddressType);

const totals: ITotals = {
    totalSubtotal: 10000,
    totalOrder: 12345,
    totalAmountDue: 0,
    totalAdditionalFees: 0,
    totalPaid: 0,
    totalFees: 0,
    totalTaxes: 1300,
    totalDiscounts: 0,
};
const shipping: IShippingLine = {id: 'ship_1', description: 'Ground', amount: 1045, code: ''};

describe('Google Ads purchase conversion', () => {
    const gtagMock = jest.fn();

    beforeEach(() => {
        gtagMock.mockReset();
        window['gtag'] = gtagMock;
        window['google_analytics_tracking_id'] = 'G-TEST';
        window['google_analytics_is_customized'] = undefined;
        window.GOOGLE_ADS = {id: 'AW-TEST', signupLabel: 'signup-label', purchaseLabel: 'test-label'};
    });

    afterEach(() => {
        delete window.GOOGLE_ADS;
        delete window['gtag'];
        delete window['google_analytics_tracking_id'];
    });

    describe('toE164', () => {
        test.each([
            ['(416) 555-0123', '+14165550123'],
            ['416-555-0123', '+14165550123'],
            ['1 416 555 0123', '+14165550123'],
            ['+1 (416) 555-0123', '+14165550123'],
        ])('valid %s', (input, expected) => {
            expect(toE164(input)).toBe(expected);
        });

        test.each([['555-0123'], ['2 416 555 0123'], ['441632960123'], ['123456789012'], [''], [undefined], [null]])('invalid %s is dropped', (input) => {
            expect(toE164(input)).toBe('');
        });
    });

    describe('formatGoogleAdsUserData', () => {
        test('maps customer and billing address, lowercasing the email', () => {
            expect(formatGoogleAdsUserData(customer, makeAddresses())).toStrictEqual({
                email: 'test.user@example.com',
                phone_number: '+14165550123',
                address: {
                    first_name: 'Ada',
                    last_name: 'Lovelace',
                    street: '1 Test Street',
                    city: 'Toronto',
                    region: 'ON',
                    postal_code: 'M5V 1A1',
                    country: 'CA',
                },
            });
        });

        test('omits an invalid phone and empty address fields', () => {
            const result = formatGoogleAdsUserData(customer, makeAddresses({
                phone_number: '12345', address_line_1: '', city: '  ', province_code: '', postal_code: '',
            }));
            expect(result.phone_number).toBeUndefined();
            expect(result.address).toStrictEqual({first_name: 'Ada', last_name: 'Lovelace', country: 'CA'});
        });

        test('omits address entirely when every field is empty, and an invalid country', () => {
            const empty = {
                first_name: '', last_name: '', address_line_1: '', city: '', province_code: '', postal_code: '', country_code: 'Canada',
            };
            const result = formatGoogleAdsUserData({...customer, first_name: '', last_name: '', email_address: ''}, makeAddresses({...empty, phone_number: ''}));
            expect(result).toStrictEqual({});
        });

        test('falls back to the customer name when the billing name is empty', () => {
            const result = formatGoogleAdsUserData(customer, makeAddresses({first_name: '', last_name: ''}));
            expect(result.address).toMatchObject({first_name: 'Cust', last_name: 'Omer'});
        });
    });

    describe('getGoogleAdsConversionValue', () => {
        test('is a number in dollars with two decimals', () => {
            const value = getGoogleAdsConversionValue([makeLine(1999, 2), makeLine(501)], []);
            expect(typeof value).toBe('number');
            expect(value).toBe(44.99);
        });

        test('subtracts product and order discounts', () => {
            expect(getGoogleAdsConversionValue([makeLine(5000, 2)], [makeDiscount(1000), makeDiscount(250)])).toBe(87.5);
        });

        test('excludes line-item fees', () => {
            expect(getGoogleAdsConversionValue([makeLine(5000, 1, [{amount: 700, name: 'Eco fee'}])], [])).toBe(50);
        });

        test('ignores tax and shipping (the helper never sees them)', () => {
            expect(getGoogleAdsConversionValue([makeLine(10000)], [])).toBe(100);
        });

        test('a shipping-only discount does not reduce the value', () => {
            expect(getGoogleAdsConversionValue([makeLine(10000)], [makeDiscount(1045, 'FREESHIP', 'Free shipping')])).toBe(100);
            expect(getGoogleAdsConversionValue([makeLine(10000)], [makeDiscount(1000), makeDiscount(1045, 'SHIPPING', 'Free shipping')])).toBe(90);
        });

        test('is clamped at 0', () => {
            expect(getGoogleAdsConversionValue([makeLine(1000)], [makeDiscount(5000)])).toBe(0);
            expect(getGoogleAdsConversionValue([], [])).toBe(0);
        });

        test('$0 swag and gift-card lines add nothing', () => {
            const swag = makeLine(0);
            const giftCard = makeLine(0);
            expect(getGoogleAdsConversionValue([makeLine(4000), swag, giftCard], [])).toBe(40);
        });

        test('rounds fractional cents to two decimals', () => {
            expect(getGoogleAdsConversionValue([makeLine(333.4)], [])).toBe(3.33);
        });
    });

    describe('orderCompleteForGoogleAds', () => {
        const run = () => orderCompleteForGoogleAds(customer, makeAddresses(), [makeLine(5000, 2)], 'CAD', [makeDiscount(1000)], 'order-123');

        test('sets user_data and then sends the conversion with the exact payload', () => {
            run();
            expect(gtagMock).toHaveBeenCalledTimes(2);
            expect(gtagMock.mock.calls[0][0]).toBe('set');
            expect(gtagMock.mock.calls[0][1]).toBe('user_data');
            expect(gtagMock.mock.calls[0][2]).toMatchObject({email: 'test.user@example.com', phone_number: '+14165550123'});
            expect(gtagMock.mock.calls[1]).toEqual(['event', 'conversion', {
                send_to: 'AW-TEST/test-label',
                value: 90,
                currency: 'CAD',
                transaction_id: 'order-123',
            }]);
            expect(typeof gtagMock.mock.calls[1][2].value).toBe('number');
        });

        test.each([
            ['no GOOGLE_ADS', undefined],
            ['missing id', {purchaseLabel: 'test-label'}],
            ['empty id', {id: '', purchaseLabel: 'test-label'}],
            ['missing label', {id: 'AW-TEST'}],
            ['empty label', {id: 'AW-TEST', purchaseLabel: ''}],
            ['blank label', {id: 'AW-TEST', purchaseLabel: '  '}],
        ])('sends nothing with %s', (_name, ads) => {
            window.GOOGLE_ADS = ads;
            run();
            expect(gtagMock).not.toHaveBeenCalled();
        });

        test('sends nothing when gtag is absent', () => {
            delete window['gtag'];
            expect(run).not.toThrow();
            expect(gtagMock).not.toHaveBeenCalled();
        });

        test('a throwing gtag is swallowed', () => {
            gtagMock.mockImplementation(() => {
                throw new Error('gtag failed');
            });
            expect(run).not.toThrow();
        });

        test('malformed input is swallowed', () => {
            expect(() => orderCompleteForGoogleAds(undefined as unknown as ICustomer, undefined as unknown as IAddressType, undefined as unknown as Array<ILineItem>, 'CAD', undefined as unknown as Array<IDiscount>, 'x')).not.toThrow();
        });
    });

    describe('orderCompleteAnalytics integration', () => {
        const call = () => orderCompleteAnalytics(customer, makeAddresses(), [makeLine(5000, 2)], 'CAD', totals, shipping, 'order-123', [makeDiscount(1000)]);

        test('GA4 purchase is unchanged and the Ads conversion fires after it', () => {
            call();
            const ga4Index = gtagMock.mock.calls.findIndex(c => c[0] === 'event' && c[1] === 'purchase');
            const adsIndex = gtagMock.mock.calls.findIndex(c => c[0] === 'event' && c[1] === 'conversion');
            expect(ga4Index).toBeGreaterThanOrEqual(0);
            expect(adsIndex).toBeGreaterThan(ga4Index);
            expect(gtagMock.mock.calls[ga4Index][2]).toStrictEqual({
                currency: 'CAD',
                transaction_id: 'order-123',
                value: '123.45',
                shipping: '10.45',
                tax: '13.00',
                coupon: 'CODE',
                items: [{
                    item_id: 'sku-5000',
                    item_name: 'Product',
                    item_variant: 'Variant',
                    price: '50.00',
                    quantity: 2,
                }],
            });
            expect(gtagMock.mock.calls[adsIndex][2].value).toBe(90);
        });

        test('a throwing gtag never propagates out of orderCompleteAnalytics', () => {
            gtagMock.mockImplementation((_a: string, name: string) => {
                if (name === 'conversion' || name === 'user_data') {
                    throw new Error('ads failed');
                }
            });
            expect(call).not.toThrow();
        });

        test('with no purchase label only GA4 is sent', () => {
            window.GOOGLE_ADS = {id: 'AW-TEST', purchaseLabel: ''};
            call();
            expect(gtagMock.mock.calls.some(c => c[1] === 'conversion' || c[1] === 'user_data')).toBe(false);
            expect(gtagMock.mock.calls.some(c => c[1] === 'purchase')).toBe(true);
        });
    });
});
